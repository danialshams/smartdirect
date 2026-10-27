/** A tiny, lazy WebGL orbital scene; CSS remains a complete fallback. */
export type OrbitMode = "hero" | "features";
export type MountedOrbit = { update(scroll:number,pointer:number):void; resize():void; dispose():void };
const VS = [
"precision highp float;",
"attribute vec3 a_data;",
"uniform vec2 u_size;",
"uniform float u_t, u_scroll, u_pointer, u_dpr, u_feature;",
"varying float v_alpha,v_point,v_tint;",
"void main(){",
" float aspect=u_size.x/max(u_size.y,1.);",
" vec3 p;",
" if(a_data.z>6.) {",
"   p=vec3(a_data.x*3.,a_data.y*2.65,(a_data.z-9.)*.65);",
"   p.x+=sin(u_t*.08+p.y*3.)*.035;",
"   v_alpha=.25+.4*(.5+.5*sin(u_t*.75+a_data.x*18.));",
"   v_point=1.;v_tint=.45;",
"   gl_PointSize=min(5.,2.3*u_dpr+(a_data.z-9.));",
" } else {",
"   float a=a_data.x+u_t*(.07+a_data.z*.03);",
"   float r=a_data.y*mix(1.,1.08,u_feature);",
"   vec3 q=vec3(cos(a)*r,sin(a)*r,sin(a*.92)*r*.25);",
"   float inc=.67+a_data.z*.27+u_scroll*.5;",
"   p=vec3(q.x*cos(u_pointer)-q.z*sin(u_pointer),",
"       q.y*cos(inc)-q.z*sin(inc),",
"       q.x*sin(u_pointer)+q.y*sin(inc)+q.z*cos(inc));",
"   v_alpha=.54+.17*sin(a+a_data.z*2.);",
"   v_point=0.;v_tint=a_data.z/3.;",
"   gl_PointSize=1.;",
" }",
" float depth=4.2-p.z;",
" vec2 clip=vec2(p.x/aspect,p.y)*(3.05/max(1.5,depth));",
" clip.y+=u_scroll*.09;",
" gl_Position=vec4(clip,0.,1.);",
"}"].join("\n");
const FS=[
"precision mediump float;",
"varying float v_alpha,v_point,v_tint;",
"void main(){",
" float a=v_alpha;",
" if(v_point>.5){float d=length(gl_PointCoord-vec2(.5))*2.;a*=pow(max(0.,1.-d),1.7);if(a<.015)discard;}",
" vec3 c=mix(vec3(.14,.4,1.),vec3(.67,.83,1.),v_tint);",
" gl_FragColor=vec4(c,a);",
"}"].join("\n");
const SEG=192, STARS=125;
function compile(gl:WebGLRenderingContext,kind:number,src:string) {
  const shader=gl.createShader(kind);
  if(!shader)return null;
  gl.shaderSource(shader,src);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}
  return shader;
}
function geometry(){
  const a:number[]=[];
  for(let ring=0;ring<3;ring++)for(let n=0;n<=SEG;n++)a.push(n/SEG*Math.PI*2,1.27+ring*.22,ring);
  let seed=14789;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let n=0;n<STARS;n++)a.push(rnd()*2-1,rnd()*2-1,9.2+rnd()*2.3);
  return new Float32Array(a);
}
export function mountOrbit(canvas:HTMLCanvasElement,mode:OrbitMode):MountedOrbit|null{
  const gl=canvas.getContext("webgl",{alpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:"low-power"});
  if(!gl||gl.isContextLost())return null;
  const context: WebGLRenderingContext = gl;
  const vs=compile(gl,gl.VERTEX_SHADER,VS),fs=compile(gl,gl.FRAGMENT_SHADER,FS);
  if(!vs||!fs){if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);return null;}
  const program=gl.createProgram();
  if(!program){gl.deleteShader(vs);gl.deleteShader(fs);return null;}
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return null;}
  const buffer=gl.createBuffer();
  if(!buffer){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return null;}
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry(),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,"a_data");
  if(attr<0){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return null;}
  gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
  const uniforms={
    size:gl.getUniformLocation(program,"u_size"), time:gl.getUniformLocation(program,"u_t"),
    scroll:gl.getUniformLocation(program,"u_scroll"), pointer:gl.getUniformLocation(program,"u_pointer"),
    dpr:gl.getUniformLocation(program,"u_dpr"), feature:gl.getUniformLocation(program,"u_feature")
  };
  gl.uniform1f(uniforms.feature,mode==="features"?1:0);
  let scroll=0,pointer=0,running=true,raf=0,w=0,h=0;
  const start=performance.now();
  function resize(){
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,rect.width<650?1.2:1.65);
    const width=Math.max(2,Math.round(rect.width*dpr)),height=Math.max(2,Math.round(rect.height*dpr));
    if(w===width&&h===height)return;
    w=width;h=height;canvas.width=width;canvas.height=height;
    context.viewport(0,0,width,height);context.uniform2f(uniforms.size,width,height);context.uniform1f(uniforms.dpr,dpr);
  }
  function render(now:number){
    if(!running||context.isContextLost())return;
    resize();context.clearColor(0,0,0,0);context.clear(context.COLOR_BUFFER_BIT);
    context.uniform1f(uniforms.time,(now-start)*.001);
    context.uniform1f(uniforms.scroll,scroll);context.uniform1f(uniforms.pointer,pointer);
    for(let i=0;i<3;i++)context.drawArrays(context.LINE_STRIP,i*(SEG+1),SEG+1);
    context.drawArrays(context.POINTS,3*(SEG+1),STARS);
    raf=requestAnimationFrame(render);
  }
  resize();raf=requestAnimationFrame(render);
  return {
    update(s,p){scroll=Math.max(-1,Math.min(1,s));pointer=Math.max(-.45,Math.min(.45,p));},
    resize,
    dispose(){
      running=false;cancelAnimationFrame(raf);
      context.disableVertexAttribArray(attr);context.deleteBuffer(buffer);context.deleteProgram(program);
      context.deleteShader(vs);context.deleteShader(fs);canvas.width=canvas.height=1;
    }
  };
}