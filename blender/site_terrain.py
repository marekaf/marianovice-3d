"""Sample the shared site grading recipe in east/south plan coordinates."""
import math
if __package__:
    from .survey_surface import height as survey_height
else:
    from survey_surface import height as survey_height


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def rect_distance(rect, x, y):
    return math.hypot(max(rect["x0"] - x, 0, x - rect["x1"]),
                      max(rect["z0"] - y, 0, y - rect["z1"]))


def polygon_distance(points, x, y):
    inside, distance = False, math.inf
    for i, b in enumerate(points):
        a = points[i - 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        if (a[1] > y) != (b[1] > y) and x < dx * (y - a[1]) / dy + a[0]:
            inside = not inside
        t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
        distance = min(distance, math.hypot(x - a[0] - t * dx, y - a[1] - t * dy))
    return 0 if inside else distance


def height(spec, x, y):
    plane = spec["plane"]
    base = survey_height(spec['surveySurface'], x, y) if spec.get('surveySurface') else max(0.0, plane["a"] * x + plane["b"] * y + plane["c"])
    continuous = spec.get('continuousGrading', False)
    h = base
    for rect in spec["cutRects"]:
        blend = rect.get("blend", spec["cutBlend"])
        distance = rect_distance(rect, x, y)
        if distance < blend:
            h = min(h, rect["level"] + ((h if continuous else base) - rect["level"]) * smoothstep(distance / blend))
    for pad in spec["fillPads"]:
        if continuous:
            distance = rect_distance(pad, x, y)
            blend = pad.get('blend', pad.get('eastBlend'))
            if distance < blend:
                h = max(h, pad['level'] + (h - pad['level']) * smoothstep(distance / blend))
            continue
        if pad["x0"] <= x <= pad["x1"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"])
        elif pad["x1"] < x < pad["x1"] + pad["eastBlend"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"] + (base - pad["level"]) * smoothstep((x - pad["x1"]) / pad["eastBlend"]))
    for pad in spec["levelPads"]:
        blend = pad.get("blend", 2.0)
        distance = rect_distance(pad, x, y)
        if distance < blend:
            h = pad["level"] + ((h if continuous else base) - pad["level"]) * smoothstep(distance / blend)
    for rect in spec["postCuts"]:
        distance = rect_distance(rect, x, y)
        if distance < rect["blend"]:
            h = min(h, rect["level"] + (h - rect["level"]) * smoothstep(distance / rect["blend"]))
    pond = spec["pond"]
    radius = math.sqrt(((x - pond["cx"]) / pond["rx"]) ** 2 + ((y - pond["cz"]) / pond["rz"]) ** 2)
    if not continuous and radius <= 1:
        h = min(h, pond["edge"] - pond["depth"] * 0.5 * (1 + math.cos(radius * math.pi)))
    elif not continuous and radius < 1.3:
        h = min(h, pond["edge"] + ((h if continuous else base) - pond["edge"]) * smoothstep((radius - 1) / 0.3))
    if spec.get('houseExcavation'):
        excavation = spec['houseExcavation']
        distance = polygon_distance(excavation['points'], x, y)
        if distance < excavation['blend']:
            h = min(h, excavation['level'] + (h - excavation['level']) * smoothstep(distance / excavation['blend']))
    if spec.get('drivewayProfile'):
        profile = spec['drivewayProfile']
        distance = max(0, polygon_distance(profile['points'], x, y) - profile['edgeMargin'])
        if distance < profile['blend']:
            level = profile['startLevel'] + (profile['gateLevel'] - profile['startLevel']) * smoothstep((x - profile['startX']) / (profile['gate'][0] - profile['startX']))
            h = level + (h - level) * smoothstep(distance / profile['blend'])
    if spec.get('finishPads'):
        distance = min(rect_distance(pad, x, y) / pad['blend'] for pad in spec['finishPads'])
        if distance < 1:
            h = spec['finishedSoil'] + (h - spec['finishedSoil']) * smoothstep(distance)
    for pad in spec.get('protectedPads', []):
        distance = rect_distance(pad, x, y)
        if distance < pad['blend']:
            h = pad['level'] + (h - pad['level']) * smoothstep(distance / pad['blend'])
    for route in spec.get('routeProfiles', []):
        samples = []
        for i in range(1, len(route['points'])):
            a, b = route['points'][i - 1], route['points'][i]
            dx, dy = b[0] - a[0], b[1] - a[1]
            t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
            d = math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
            samples.append((d, route['levels'][i - 1] + (route['levels'][i] - route['levels'][i - 1]) * t))
        distance = min(sample[0] for sample in samples)
        weighted, total = 0, 0
        for d, value in samples:
            weight = smoothstep(1 - (d - distance) / .2)
            weighted += value * weight
            total += weight
        level = weighted / total
        distance = max(0, distance - route['width'] / 2)
        if distance < .5:
            h = level - .04 + (h - level + .04) * smoothstep(distance / .5)
    if continuous and radius <= 1:
        h = min(h, pond['edge'] - pond['depth'] * .5 * (1 + math.cos(radius * math.pi)))
    elif continuous and radius < 1.3:
        h = min(h, pond['edge'] + (h - pond['edge']) * smoothstep((radius - 1) / .3))
    return h
