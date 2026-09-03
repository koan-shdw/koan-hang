"""Context blocks: OpenStreetMap buildings and roads around the gallery (scan/osm/raw.json, Overpass 2026-09-03), turned into
level coordinates and written to level/context.json. Generic blocks only (owner: 'generic will do').

Alignment (see docs/CONTEXT.md): OSM way 138960255 is the gallery's plot (3 levels, 12.5 m long, street face 4.4 m).
Our +x (glass -> yard) = bearing 316.5 deg; our +z = bearing 46.5 deg (NE); origin fitted so our outer back face sits on the
plot's street edge. Check: the street-view photo shows the 2-storey balcony house on the LEFT of the back facade = SW =
our -z side; the red intro wall is 'immediate left stepping out the front door' = -z. Both agree.
Buildings that overlap our own plot are clipped by it (shapely difference) so nothing sits on the gallery or its yard."""
import json, math
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union
LAT0, LON0 = 35.66629, 139.70549
XB, ZB = 316.5, 46.5                       # bearings of our +x and +z axes
OX, OY = -3.76, 4.26                       # map (east, north) of our origin
G0 = -5.54
LEVEL_H = 3.2                              # metres per mapped level
DEFAULT_LEVELS = 3
RADIUS = 220                               # metres kept around the gallery
PLOT = box(-7.30, -4.60, 7.00, 5.20)       # our building + yard in level coords (x, z), nothing else goes here
STREET = box(-12.8, -45, -7.8, 45)         # the back street: not in OSM; street-view photo shows a ~5 m lane along our back face (manual)
KEEP_OUT = unary_union([PLOT.buffer(1.0), STREET])
def to_map(lat, lon): return ((lon - LON0) * math.cos(math.radians(LAT0)) * 111320, (lat - LAT0) * 110540)
xa = (math.sin(math.radians(XB)), math.cos(math.radians(XB)))
za = (math.sin(math.radians(ZB)), math.cos(math.radians(ZB)))
def to_level(e, n):
    e -= OX; n -= OY
    return (round(e * xa[0] + n * xa[1], 2), round(e * za[0] + n * za[1], 2))
d = json.load(open("scan/osm/raw.json", encoding="utf-8"))
blocks, roads = [], []
taken = Polygon()
for el in d["elements"]:
    t = el.get("tags", {})
    pts = [to_level(*to_map(p["lat"], p["lon"])) for p in el.get("geometry", [])]
    if len(pts) < 2: continue
    if "building" in t:
        if len(pts) < 4: continue
        poly = Polygon(pts)
        if not poly.is_valid: poly = poly.buffer(0)
        if poly.is_empty or poly.centroid.distance(Polygon([(0, 0), (1, 0), (1, 1)]).centroid) > RADIUS: continue
        if el["id"] == 138960255: continue                       # our own plot: the level itself
        if poly.intersects(KEEP_OUT):
            poly = poly.difference(KEEP_OUT)
        if poly.is_empty: continue
        # no two blocks overlap in plan, and every block stands 3 cm clear of its neighbours: no crossing or shared faces
        poly = poly.difference(taken).buffer(-0.03)
        if poly.is_empty or poly.area < 4: continue
        taken = unary_union([taken, Polygon(pts).buffer(0)])
        h = float(t["height"]) if t.get("height", "").replace(".", "").isdigit() else None
        if h is None:
            lv = t.get("building:levels", "")
            h = (float(lv) if lv.replace(".", "").isdigit() else DEFAULT_LEVELS) * LEVEL_H
        h += (el["id"] % 17) * 0.01                       # roofs never on one plane
        geoms = [poly] if poly.geom_type == "Polygon" else list(poly.geoms)
        for g in geoms:
            blocks.append(dict(kind="block", name=t.get("name", t.get("building", "building")), poly=[[round(x, 2), round(z, 2)] for x, z in g.exterior.coords[:-1]],
                               h=round(h, 2), levels=t.get("building:levels"), src=f"osm way {el['id']}" + (" clipped by our plot" if poly.area != Polygon(pts).area else "")))
    elif "highway" in t:
        line = LineString(pts)
        if line.distance(Polygon([(0, 0), (1, 0), (1, 1)])) > RADIUS: continue
        kind = t["highway"]
        w = {"secondary": 9, "residential": 5, "unclassified": 4.5, "service": 3.5, "pedestrian": 4, "footway": 1.6, "path": 1.4, "steps": 1.4}.get(kind, 3)
        if t.get("width", "").replace(".", "").isdigit(): w = float(t["width"])
        roads.append(dict(kind="road", name=t.get("name", kind), pts=[[x, z] for x, z in pts], w=w, src=f"osm way {el['id']}"))
# the back street is not in OSM: from the street-view photo, a narrow street along our back face (manual, ~4 m wide, 4.5 m off the face)
roads.append(dict(kind="road", name="back street (not in OSM; street-view photo)", pts=[[-10.3, -45], [-10.3, 45]], w=5.0, src="street-view photo 2021-05, manual"))
ctx = dict(source="OpenStreetMap via Overpass 2026-09-03, ODbL; alignment scan/osm/blocks.py", blocks=blocks, roads=roads,
           ground=dict(kind="ground", r=RADIUS + 40, y=G0 - 0.02, src="plate under everything"))
json.dump(ctx, open("level/context.json", "w"), indent=1)
near = sorted(blocks, key=lambda b: Polygon(b["poly"]).distance(PLOT))[:8]
print(f"blocks {len(blocks)}, roads {len(roads)}")
for b in near: print(f"  {b['name'][:24]:24s} h {b['h']:5.1f} dist {Polygon(b['poly']).distance(PLOT):5.1f}  {b['src']}")
