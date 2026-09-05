"""Sample the shared site grading recipe in east/south plan coordinates."""
import math


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def rect_distance(rect, x, y):
    return math.hypot(max(rect["x0"] - x, 0, x - rect["x1"]),
                      max(rect["z0"] - y, 0, y - rect["z1"]))


def height(spec, x, y):
    plane = spec["plane"]
    base = max(0.0, plane["a"] * x + plane["b"] * y + plane["c"])
    h = base
    for rect in spec["cutRects"]:
        blend = rect.get("blend", spec["cutBlend"])
        distance = rect_distance(rect, x, y)
        if distance < blend:
            h = min(h, rect["level"] + (base - rect["level"]) * smoothstep(distance / blend))
    for pad in spec["fillPads"]:
        if pad["x0"] <= x <= pad["x1"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"])
        elif pad["x1"] < x < pad["x1"] + pad["eastBlend"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"] + (base - pad["level"]) * smoothstep((x - pad["x1"]) / pad["eastBlend"]))
    for pad in spec["levelPads"]:
        blend = pad.get("blend", 2.0)
        distance = rect_distance(pad, x, y)
        if distance < blend:
            h = pad["level"] + (base - pad["level"]) * smoothstep(distance / blend)
    for rect in spec["postCuts"]:
        distance = rect_distance(rect, x, y)
        if distance < rect["blend"]:
            h = min(h, rect["level"] + (h - rect["level"]) * smoothstep(distance / rect["blend"]))
    pond = spec["pond"]
    radius = math.sqrt(((x - pond["cx"]) / pond["rx"]) ** 2 + ((y - pond["cz"]) / pond["rz"]) ** 2)
    if radius <= 1:
        h = min(h, pond["edge"] - pond["depth"] * 0.5 * (1 + math.cos(radius * math.pi)))
    elif radius < 1.3:
        h = min(h, pond["edge"] + (base - pond["edge"]) * smoothstep((radius - 1) / 0.3))
    return h
