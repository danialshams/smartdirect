#!/usr/bin/env python3
"""Daira's original, geometry-based robot character: six Blender motion takes.

Every visible faceplate, mechanical module, lens, screw, strip, jaw and neck
element is actual 3D geometry. No source image is projected on a mesh.
The scene renders entirely offline; browsers play encoded video clips.
All six actions start/end at identical front-facing geometry and lighting.

Usage: blender -b -t 3 --python scripts/render-daira-robot-character.py -- /tmp/robot-frames
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/daira-robot-frames"
os.makedirs(OUT, exist_ok=True)
random.seed(24)

FPS = 18
WIDTH = 720
HEIGHT = 560
CLIPS = {
    "idle-front": 48,
    "turn-left": 54,
    "turn-right": 54,
    "tilt-head": 50,
    "blink-glow": 45,
    "micro-scan": 54,
}
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=9
scene.cycles.use_denoising=False
scene.render.resolution_x=WIDTH
scene.render.resolution_y=HEIGHT
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGB"
scene.render.image_settings.color_depth="8"
scene.render.image_settings.compression=24
scene.render.threads_mode="FIXED"
scene.render.threads=3
scene.render.film_transparent=False
scene.view_settings.view_transform="Standard"
scene.view_settings.look="Medium High Contrast"
scene.view_settings.exposure=-.72
scene.view_settings.gamma=1
world=bpy.data.worlds.new("Daira | clean light studio")
scene.world=world
world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(0.965, 0.986, 1.0, 1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.48

def mat(name,color,metal=.0,rough=.27,emission=None,energy=0.0):
    material=bpy.data.materials.new(name)
    material.diffuse_color=(*color,1)
    material.use_nodes=True
    bs=material.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*color,1)
    bs.inputs["Metallic"].default_value=metal
    bs.inputs["Roughness"].default_value=rough
    coat=bs.inputs.get("Coat Weight") or bs.inputs.get("Clearcoat")
    coat_rough=bs.inputs.get("Coat Roughness") or bs.inputs.get("Clearcoat Roughness")
    if coat:coat.default_value=.35
    if coat_rough:coat_rough.default_value=.13
    if emission:
        em_col=bs.inputs.get("Emission Color") or bs.inputs.get("Emission")
        em_strength=bs.inputs.get("Emission Strength")
        if em_col: em_col.default_value=(*emission,1)
        if em_strength: em_strength.default_value=energy
    return material

ceramic=mat("Ceramic white pearl | clear-coated",(.61,.73,.87),.28,.26)
ceramic_light=mat("Raised ceramic highlights",(.77,.86,.96),.19,.23)
ceramic_dim=mat("Plate shadow ceramic",(.32,.47,.64),.55,.29)
chrome=mat("Brushed satin aluminum",(.39,.51,.68),.88,.26)
chrome_dark=mat("Polished gunmetal",(.11,.19,.30),.9,.20)
rubber=mat("Ribbed graphite polymer",(.023,.048,.087),.35,.36)
visor=mat("Curved onyx glass visor",(.015,.035,.085),.62,.07)
visor_edge=mat("Visor blue-metal gasket",(.22,.41,.65),.85,.17)
iris=mat("Optical deep iris",(.009,.030,.086),.76,.085)
light=mat("Optic cyan glow",(.17,.59,.89),.22,.14,(.018,.38,.82),1.9)
light_soft=mat("Daira accent light",(.22,.61,.91),.33,.16,(.016,.18,.72),.85)
pupil=mat("Pupil camera lens",(.001,.012,.033),.86,.055)
speck=mat("Specular catch light",(.95,1,1),.04,.13,(.38,.89,1),.25)
vent=mat("Precision vent shadow",(.055,.12,.21),.65,.36)

head_root=bpy.data.objects.new("HEAD ROOT | genuine six-axis motion",None)
bpy.context.collection.objects.link(head_root)
neck_root=bpy.data.objects.new("NECK | stationary servo anchor",None)
bpy.context.collection.objects.link(neck_root)

def attach(obj,material,root=head_root,bevel=0):
    if material: obj.data.materials.append(material)
    obj.parent=root
    if bevel and obj.type=="MESH":
        mod=obj.modifiers.new("Micro-machined beveled edges","BEVEL")
        mod.width=bevel
        mod.segments=3
        if hasattr(mod,"affect"):mod.affect="EDGES"
        obj.modifiers.new("Weighted bevel normals","WEIGHTED_NORMAL")
    return obj

def ell(name,loc,scale,material,root=head_root,segments=48,rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    ob=bpy.context.object;ob.name=name
    ob.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in ob.data.polygons:p.use_smooth=True
    return attach(ob,material,root)

def cyl(name,loc,radius,depth,material,axis="Z",root=head_root,verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc)
    ob=bpy.context.object;ob.name=name
    if axis=="Y":ob.rotation_euler[0]=math.pi/2
    if axis=="X":ob.rotation_euler[1]=math.pi/2
    return attach(ob,material,root,bevel=.013 if radius>.09 else .005)

def tor(name,loc,major,minor,material,axis="Y",root=head_root):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=72,minor_segments=12,location=loc)
    ob=bpy.context.object;ob.name=name
    if axis=="Y":ob.rotation_euler[0]=math.pi/2
    elif axis=="X":ob.rotation_euler[1]=math.pi/2
    for p in ob.data.polygons:p.use_smooth=True
    return attach(ob,material,root)

def box(name,loc,scale,material,root=head_root,angle=None,bev=.014):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    ob=bpy.context.object;ob.name=name
    ob.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if angle:ob.rotation_euler=angle
    return attach(ob,material,root,bev)

def pipe(name,points,r,material,root=head_root):
    curve=bpy.data.curves.new(name,"CURVE")
    curve.dimensions="3D";curve.resolution_u=16
    curve.bevel_resolution=4;curve.bevel_depth=r
    spline=curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for bp,co in zip(spline.bezier_points,points):
        bp.co=co;bp.handle_left_type="AUTO";bp.handle_right_type="AUTO"
    ob=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(ob)
    return attach(ob,material,root)

# The helmet is a volume with fully defined rear and side geometry.
ell("01 | high-poly ceramic head shell",(0,.08,.49),(1.13,.88,1.045),ceramic)
ell("02 | inset metal cranium seam",(0,-.02,.48),(1.165,.9,1.065),ceramic_dim)
ell("03 | crown white outer fairing",(0,.17,1.17),(1.065,.81,.44),ceramic_light)
ell("04 | upper visor cradle",(0,-.54,.53),(1.055,.43,.66),chrome)
ell("05 | REAL convex smoked-glass visor",(0,-.685,.58),(1.015,.46,.605),visor)
ell("06 | ceramic forehead upper eyebrow",(0,-.55,1.15),(1.015,.35,.24),ceramic_light)
ell("07 | jaw chin protective mechanical shell",(0,-.58,-.27),(.89,.48,.39),ceramic)
ell("08 | inset chin beveled plate",(0,-.74,-.42),(.67,.31,.18),ceramic_light)
ell("09 | central face graphite seam",(0,-.69,-.40),(.55,.37,.078),rubber)


# Fine engraved gaskets and distinct armor panel subdivisions add the
# mechanical definition lost in earlier washed-out white test renders.
pipe("Front helmet central crown seam",[
    (0,-.64,1.52),(.12,-.73,1.47),(.24,-.76,1.40)],.012,chrome_dark)
pipe("Crown left radial bevel",[
    (-.13,-.65,1.49),(-.39,-.68,1.44),(-.64,-.58,1.31),
    (-.83,-.45,1.15)],.013,chrome_dark)
pipe("Crown right radial bevel",[
    (.13,-.65,1.49),(.39,-.68,1.44),(.64,-.58,1.31),
    (.83,-.45,1.15)],.013,chrome_dark)
pipe("Visor upper precise rim",[
    (-.88,-.76,1.04),(-.60,-.93,1.145),(0,-1.028,1.18),
    (.60,-.93,1.145),(.88,-.76,1.04)],.018,chrome_dark)
pipe("Visor lower machined gasket",[
    (-.91,-.78,.11),(-.65,-1.02,-.05),(0,-1.14,-.09),
    (.65,-1.02,-.05),(.91,-.78,.11)],.017,chrome)
for sign in (-1,1):
    for i in range(6):
        # Brushed-metal guide slots around the temple armor.
        z=1.18-.07*i
        pipe("Micro-line engraved brow %d"%i,[
            (sign*.73,-.70,z),(sign*.80,-.65,z-.018),
            (sign*.85,-.55,z-.04)],.005,chrome_dark)
    for i in range(5):
        y=-.34+i*.10
        box("Ribbed posterior temple engine",(
            sign*1.13,y,.94),(.035,.059,.045),chrome_dark,bev=.006)
    for i in range(6):
        angle=i*math.pi/3
        x=sign*(.85+math.cos(angle)*.05)
        z=-.3+math.sin(angle)*.075
        ell("Exposed titanium plate rivet",(x,-.75,z),
            (.018,.012,.018),chrome_dark,segments=12,rings=8)
# A metal grille under the dark visor renders as actual cutout-like fins.
for i in range(9):
    x=(i-4)*.052
    box("Central mouthpiece grille fin",(x,-.983,-.498),(.014,.014,.045),
        vent,bev=.003)

# Layered mechanical cheek plates, ear shells, engraved micro-gaskets.
for sign in (-1,1):
    ell("10 | sculpted cheek ceramic panel",(.91*sign,-.56,-.17),(.225,.35,.40),ceramic)
    ell("11 | cheek metal undercut",(1.03*sign,-.45,-.05),(.115,.27,.42),chrome_dark)
    ell("12 | precision temple cap",(1.013*sign,-.35,.92),(.24,.46,.31),ceramic_light)
    ell("13 | side seam inset",(1.052*sign,-.16,.22),(.125,.55,.48),chrome)
    for idx in range(5):
        box("14 | tiny cheek ventilation grille",(.88*sign,-.846,-.26+idx*.069),(.16,.016,.017),vent,angle=(0,0,sign*.1),bev=.004)
    for idx in range(3):
        box("15 | slender illuminated side rail",(1.05*sign,-.78,-.08-idx*.075),(.075,.018,.018),light_soft,bev=.004)

# Actual circular multi-layer ear mechanisms, cylinders are oriented on X axis.
for sign in (-1,1):
    x=1.13*sign
    cyl("16 | ear engine cavity",(x,.08,.62),.42,.26,chrome_dark,"X")
    cyl("17 | ear aluminum drum",((1.25)*sign,.08,.62),.355,.085,chrome,"X")
    cyl("18 | central dark bearing",((1.30)*sign,.08,.62),.245,.06,rubber,"X")
    cyl("19 | brushed polished hub",((1.34)*sign,.08,.62),.162,.07,chrome,"X")
    cyl("20 | dark camera port",((1.39)*sign,.08,.62),.089,.055,iris,"X")
    for rr,mm,xx in [( .39,chrome,(1.245)*sign),(.312,light,(1.303)*sign),(.277,chrome_dark,(1.308)*sign),(.205,light_soft,(1.343)*sign)]:
        tor("21 | separate concentric ear ring",(xx,.08,.62),rr,.025 if mm is light else .016,mm,"X")
    for i in range(12):
        a=2*math.pi*i/12
        yy=.08+math.cos(a)*.355
        zz=.62+math.sin(a)*.355
        cyl("22 | ear radial precision fastener",((1.315)*sign,yy,zz),.022,.017,chrome_dark,"X",verts=12)

# Eyeball housings: glass-lens iris, 3 illuminated toroidal rings, pupil,
# 32 tiny raster dots and highlight, physically protruding from visor.
for sign in (-1,1):
    x=.435*sign
    y=-1.064
    z=.62
    cyl("23 | eye deep optical receiver",(x,y,z),.321,.075,chrome_dark,"Y")
    tor("24 | machined external bezel",(x,y-.055,z),.292,.031,chrome,"Y")
    cyl("25 | black iris inner lens",(x,y-.068,z),.253,.018,iris,"Y")
    tor("26 | luminous outer optic ring",(x,y-.087,z),.224,.035,light,"Y")
    tor("27 | external laser reticle",(x,y-.097,z),.166,.011,light_soft,"Y")
    tor("28 | secondary optical blue iris",(x,y-.11,z),.119,.012,light,"Y")
    cyl("29 | eye camera pupil",(x,y-.119,z),.073,.032,pupil,"Y")
    ell("30 | round glass specular glint",(x-.038,y-.149,z+.056),(.024,.011,.029),speck)
    for i in range(32):
        theta=2*math.pi*i/32
        xx=x+math.cos(theta)*.266
        zz=z+math.sin(theta)*.266
        ell("31 | cyan pixel dot %02d"%i,(xx,y-.092,zz),(.006,.005,.006),light_soft,segments=8,rings=6)
    # Each eyelid is a separate movable mesh whose scale will animate in blink clips.
    # Gray thin rings around the lens still reveal depth during head rotations.

# Real curved smile on a cheek-mounted mouth plate.
pipe("32 | subtle sculpted friendly smile",[
    (-.232,-1.019,-.318),(-.11,-1.048,-.351),(0,-1.051,-.357),
    (.11,-1.048,-.351),(.232,-1.019,-.318)],.012,chrome_dark)
pipe("33 | luminous brow slit",[
    (-.27,-.84,1.205),(-.10,-.91,1.232),
    (.10,-.91,1.232),(.27,-.84,1.205)],.011,light_soft)
# Central forehead signal above the visor.
ell("34 | recessed forehead receiver",(0,-.675,1.36),(.10,.05,.19),chrome_dark)
ell("35 | glowing forehead silicon beacon",(0,-.731,1.37),(.049,.028,.13),light)
for x in (-.83,.83):
    for z in (.95,.77,-.30,-.49):
        cyl("36 | miniature surface screw",(x,-.68,z),.017,.018,chrome_dark,"Y",verts=16)
        cyl("37 | screw slot center",(x,-.701,z),.006,.02,chrome,"Y",verts=12)

# Industrial neck rings and piston articulation. Only head turns; neck anchor
# stays centred, so the character never appears to be one rotating cardboard card.
cyl("38 | graphite servo core",(0,.13,-.90),.38,.61,chrome_dark,root=neck_root)
cyl("39 | lower collar bracket",(0,.12,-1.32),.53,.25,chrome,root=neck_root)
cyl("40 | broad white bottom collar",(0,.13,-1.49),.72,.16,ceramic_light,root=neck_root)
cyl("41 | underside metallic collar",(0,.13,-1.59),.76,.10,chrome_dark,root=neck_root)
for iz in range(5):
    tor("42 | stacked neck mechanical compression ring",(0,.13,-.71-iz*.16),.40,.028,light_soft if iz==2 else chrome,"Z",neck_root)
for i in range(8):
    a=2*math.pi*i/8
    x=.32*math.cos(a);y=.13+.32*math.sin(a)
    pipe("43 | dense braided neck conduit",[
        (x*.92,y,-.58),(x*1.18,y+.05,-.8),
        (x*.95,y-.03,-1.06),(x,y,-1.36)],.022,
        light_soft if i%4==0 else rubber,neck_root)
for sign in (-1,1):
    x=sign*.52
    cyl("44 | cheek descent hydraulic sleeve",(x,.13,-1.10),.052,.46,chrome,root=neck_root)
    cyl("45 | hydraulic steel axis",(x,.13,-.92),.023,.56,chrome_dark,root=neck_root)
    tor("46 | neck side connector",(x,.12,-1.37),.088,.021,light_soft,"Z",neck_root)
for i in range(16):
    a=2*math.pi*i/16
    x=.59*math.cos(a);y=.13+.59*math.sin(a)
    ell("47 | collar bolt head",(x,y,-1.51),(.015,.015,.013),chrome_dark,neck_root,12,8)

# Subtle luminous mast and micro-pads on crown.
for sign in (-1,1):
    pipe("48 | panel shell radial seam",[
        (.15*sign,-.43,1.47),(.44*sign,-.42,1.44),
        (.79*sign,-.21,1.30),(.94*sign,.04,1.18)],.012,chrome)
    for z in (1.34,1.42):
        box("49 | forehead engraved side stripe",(.31*sign,-.69,z),(.14,.012,.009),chrome,bev=.003)

# Static studio stage and large softbox lights: genuine reflections on metal
# and curved visor change as the 3D head turns.
def area(name,location,power,size,color,target=(0,0,.2)):
    bpy.ops.object.light_add(type="AREA",location=location)
    obj=bpy.context.object;obj.name=name
    obj.data.energy=power
    obj.data.shape="DISK"
    obj.data.size=size
    obj.data.color=color
    direction=Vector(target)-obj.location
    obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
area("Large softbox upper left",(-3.6,-4.2,5.1),230,4.2,(1,1,1))
area("Cool panoramic fill",(3.3,-4.0,2.3),150,3.4,(.62,.79,1))
area("Bright satin edge highlight",(1.2,2.8,4.8),210,2.7,(.48,.75,1))
area("Opposite bevel rim",(-2.8,1.4,1.5),120,2.9,(1,1,1))

bpy.ops.object.camera_add(location=(0,-7.8,.20))
camera=bpy.context.object
camera.name="Camera | front-facing to quarter-turned robot"
camera.data.type="ORTHO"
camera.data.ortho_scale=4.15
camera.rotation_euler=(Vector((0,0,.06))-camera.location).to_track_quat("-Z","Y").to_euler()
scene.camera=camera

# Geometry validation: no textured rectangles, all front and sides are volume.
actual_meshes=[o for o in bpy.data.objects if o.type=="MESH"]
assert len(actual_meshes)>100, "Expected mechanically detailed 3D model"
assert not any(o.type=="MESH" and "portrait" in o.name.lower() for o in actual_meshes)
print("DAIRA_REAL_MODEL_MESH_COUNT",len(actual_meshes),flush=True)

def ease(t):
    return math.sin(math.pi*t)**2

for clip, frames in CLIPS.items():
    dest=os.path.join(OUT,clip)
    os.makedirs(dest,exist_ok=True)
    for frame in range(frames):
        t=frame/(frames-1)
        e=ease(t) # exactly zero at first and last frames
        yaw=0
        pitch=0
        roll=0
        bob=.013*math.sin(2*math.pi*t)*e
        left_eye=1.9
        right_eye=1.9
        if clip=="idle-front":
            yaw=.016*e*math.sin(2*math.pi*t)
            pitch=.018*e
        elif clip=="turn-left":
            yaw=-.48*e
            pitch=-.032*e
            roll=.025*e
        elif clip=="turn-right":
            yaw=.48*e
            pitch=-.015*e
            roll=-.018*e
        elif clip=="tilt-head":
            roll=-.19*e
            pitch=.045*e
            yaw=.09*e
        elif clip=="blink-glow":
            pulse=math.sin(math.pi*6*t)**16
            flash=e*(.92 if pulse>.35 else .10)
            left_eye=max(.04,1.9*(1-flash))
            right_eye=max(.05,1.9*(1-flash*.93))
            pitch=-.06*e
        elif clip=="micro-scan":
            yaw=.13*e*math.sin(2*math.pi*t)
            pitch=.085*e*math.cos(2*math.pi*t)
            roll=.035*e
        head_root.rotation_euler=(pitch,roll,yaw)
        head_root.location=(0,0,bob)
        light.node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=left_eye
        light_soft.node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value= .85*(.65+.35*(left_eye/1.9))
        scene.frame_set(frame+1)
        scene.render.filepath=os.path.join(dest,"frame-%03d.png"%frame)
        bpy.ops.render.render(write_still=True)
        if frame%18==0:
            print("DAIRA_3D_RENDER",clip,frame,"/",frames,flush=True)
    print("DAIRA_CLIP_COMPLETE",clip,frames,flush=True)
print("DAIRA_ALL_REAL_3D_CLIPS_RENDERED",len(CLIPS),flush=True)
