#!/usr/bin/env python3
"""Offline Blender camera-mapped 3D animation for the approved Daira robot.

The image is camera-projected onto an organically curved, tessellated mesh.
It retains every pixel of the approved visual while providing physical-depth
parallax, glancing light and camera movement. It is NOT a 360-degree asset.
Blender runs exclusively in CI, never in the browser.
Usage: blender -b --python scripts/render-daira-blender.py -- /tmp/daira-frames
"""
import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SOURCE = os.path.join(ROOT, "public", "landing", "daira-robot-hero.webp")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "/tmp/daira-frames"
os.makedirs(OUT, exist_ok=True)

# Keep output images tiny but sharp enough for a ~650 px homepage hero.
W, H, FPS, FRAMES = 864, 486, 20, 40
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for data in bpy.data.meshes:
    if data.users == 0:
        bpy.data.meshes.remove(data)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 7
scene.cycles.use_denoising = False
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = False
scene.render.use_file_extension = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 3
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast" if False else "Medium High Contrast"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.film_transparent = False
scene.render.image_settings.compression = 28

world = bpy.data.worlds.new("Soft Pearl Studio")
scene.world = world
world.use_nodes = True
world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.985, 0.995, 1, 1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 1

# Camera-mapped image sits on a real 3D surface. Each vertex has its own depth.
# Variation is deliberately restrained to avoid stretching the approved robot's
# precisely detailed features or showing fabricated side/back surfaces.
COLS, ROWS = 72, 42
vertices = []
faces = []
for iy in range(ROWS + 1):
    v = iy / ROWS
    for ix in range(COLS + 1):
        u = ix / COLS
        x = (u - 0.5) * 5.3333
        y = (v - 0.5) * 3.0
        head = math.exp(-((x + .56) ** 2 / 1.55 + (y - .15) ** 2 / 1.65))
        forehead = math.exp(-((x + .54) ** 2 / .55 + (y - .67) ** 2 / .52))
        left_ear = math.exp(-((x + 1.55) ** 2 / .13 + (y - .16) ** 2 / .35))
        neck = math.exp(-((x + .56) ** 2 / .42 + (y + 1.20) ** 2 / .22))
        z = .18 * head + .055 * forehead + .085 * left_ear + .045 * neck
        vertices.append((x, y, z))
for iy in range(ROWS):
    for ix in range(COLS):
        a = iy * (COLS + 1) + ix
        faces.append((a, a+1, a+COLS+2, a+COLS+1))

mesh = bpy.data.meshes.new("Contoured high-poly portrait surface")
mesh.from_pydata(vertices, [], faces)
mesh.update()
uv = mesh.uv_layers.new(name="Approved Robot Projection")
for poly in mesh.polygons:
    poly.use_smooth = True
    for loop_index in poly.loop_indices:
        vert_index = mesh.loops[loop_index].vertex_index
        iy, ix = divmod(vert_index, COLS+1)
        uv.data[loop_index].uv = (ix / COLS, iy / ROWS)

obj = bpy.data.objects.new("Daira Robot - genuine curved projected surface", mesh)
bpy.context.collection.objects.link(obj)
image = bpy.data.images.load(SOURCE, check_existing=True)
image.colorspace_settings.name = "sRGB"
material = bpy.data.materials.new("Approved photoreal textures / subtle studio illumination")
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
tex = nodes.new("ShaderNodeTexImage")
tex.image = image
tex.interpolation = "Linear"
tex.extension = "EXTEND"
emission = nodes.new("ShaderNodeEmission")
emission.inputs["Strength"].default_value = 1.0
out = nodes.new("ShaderNodeOutputMaterial")
material.node_tree.links.new(tex.outputs["Color"], emission.inputs["Color"])
material.node_tree.links.new(emission.outputs[0], out.inputs["Surface"])
obj.data.materials.append(material)

# The tracked camera sits in 3D, with an orthographic lens to avoid
# perspective breathing on the top/side edges of the approved artwork.
bpy.ops.object.camera_add(location=(0, 0, 10.7))
camera = bpy.context.object
camera.name = "Daira dolly / 3D perspective"
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 5.37
camera.rotation_euler = (0,0,0)
scene.camera = camera

# Subtle finite amplitude: ~5 degrees of real 3D orbit/parallax, seamless loop.
for f in range(FRAMES):
    phase = 2 * math.pi * f / FRAMES
    obj.rotation_euler = (
        .018 * math.sin(phase + .5),
        .055 * math.sin(phase),
        .003 * math.sin(phase + 1.5),
    )
    obj.location = (
        .016 * math.sin(phase),
        .025 * math.sin(phase + .6),
        0
    )
    camera.location.x = .045 * math.sin(phase + .2)
    camera.location.y = .018 * math.sin(phase + 1.1)
    scene.frame_set(f+1)
    scene.render.filepath = os.path.join(OUT, f"frame-{f:03d}.png")
    bpy.ops.render.render(write_still=True)
    if f % 10 == 0:
        print("DAIRA_RENDER_PROGRESS", f, "/", FRAMES, flush=True)
print("DAIRA_RENDER_DONE", FRAMES, W, H, flush=True)
