
import init, { get_telemetry } from "./pkg/sat_dashboard_wasm.js";

// --- Telemetry ---
const canvas=document.getElementById("signal-chart");const ctx=canvas.getContext("2d");
canvas.width=canvas.offsetWidth;canvas.height=160;
let telemetry=new Array(60).fill(0);let telemetryPaused=false;
function drawTelemetry(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#60a5fa";ctx.lineWidth=2;ctx.beginPath();
telemetry.forEach((v,i)=>{const x=i/(telemetry.length-1)*canvas.width;const y=canvas.height-v*canvas.height;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();}
function updateTelemetry(){if(!telemetryPaused){telemetry.shift();telemetry.push(Math.random()*0.9+0.05);drawTelemetry();logEvent("Telemetry updated.");}}
setInterval(updateTelemetry,120);

// --- Status Indicators ---
function setStatus(id,state){const dot=document.getElementById(id);switch(state){case"ok":dot.style.background="var(--ok)";break;case"warn":dot.style.background="var(--warn)";break;case"err":dot.style.background="var(--err)";break;default:dot.style.background="gray";}}
setStatus("gpu-status","ok");setStatus("wasm-status","ok");setStatus("telemetry-status","ok");setStatus("engine3d-status","ok");

// --- Telemetry Controls ---
document.getElementById("pause-telemetry").addEventListener("click",()=>telemetryPaused=true);
document.getElementById("resume-telemetry").addEventListener("click",()=>telemetryPaused=false);
document.getElementById("toggle-view").addEventListener("click",()=>{
    const orbit2d=document.getElementById("orbit-map");const orbit3d=document.getElementById("orbit-3d");
    if(orbit2d.style.display==="none"){orbit2d.style.display="block";orbit3d.style.display="none";}else{orbit2d.style.display="none";orbit3d.style.display="block";}
});

// --- Satellites ---
const satTable=document.getElementById("sat-table");const satellites=[{id:"SAT-001",alt:540,status:"OK"},{id:"SAT-002",alt:612,status:"WARN"},{id:"SAT-003",alt:700,status:"OK"}];
function updateSatelliteTable(){satellites.forEach(s=>{s.alt+=(Math.random()-0.5)*0.3});satTable.innerHTML=satellites.map(s=>`<tr><td>${s.id}</td><td>${s.alt.toFixed(1)} km</td><td style="color:${s.status==="OK"?"var(--ok)":"var(--warn)"}">${s.status}</td></tr>`).join("");}
setInterval(updateSatelliteTable,1000);

// --- Satellite Details ---
const satDetails=document.getElementById("sat-details");
satTable.addEventListener("click",(e)=>{const row=e.target.closest("tr");if(!row)return;const satId=row.children[0].innerText;const sat=satellites.find(s=>s.id===satId);if(sat){satDetails.innerHTML=`<p><strong>ID:</strong> ${sat.id}</p><p><strong>Altitude:</strong> ${sat.alt.toFixed(1)} km</p><p><strong>Status:</strong> ${sat.status}</p><p><strong>Velocity:</strong> ${(Math.random()*7.8).toFixed(2)} km/s</p>`;}});

// --- Log Console ---
const logConsole=document.getElementById("log-console");
function logEvent(message){const timestamp=new Date().toLocaleTimeString();logConsole.innerText+=`[${timestamp}] ${message}
`;logConsole.scrollTop=logConsole.scrollHeight;}
logEvent("Dashboard initialized.");

// --- Quick Actions ---
document.getElementById("fullscreen-btn").addEventListener("click",()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();});
document.getElementById("reset-engine").addEventListener("click",()=>{telemetry.fill(0);drawTelemetry();logEvent("Engine reset performed.");});
document.getElementById("gpu-test-btn").addEventListener("click",()=>logEvent("GPU test triggered."));
document.getElementById("3d-test-btn").addEventListener("click",()=>logEvent("3D orbit test triggered."));

// --- Orbit Map 2D ---
const orbitCanvas=document.getElementById("orbit-map");const orbitCtx=orbitCanvas.getContext("2d");
orbitCanvas.width=orbitCanvas.offsetWidth;orbitCanvas.height=220;
const center={x:orbitCanvas.width/2,y:orbitCanvas.height/2};let angle=0;
function drawOrbit(){orbitCtx.clearRect(0,0,orbitCanvas.width,orbitCanvas.height);orbitCtx.fillStyle="#1e40af";orbitCtx.beginPath();orbitCtx.arc(center.x,center.y,20,0,Math.PI*2);orbitCtx.fill();orbitCtx.strokeStyle="#334155";orbitCtx.beginPath();orbitCtx.arc(center.x,center.y,80,0,Math.PI*2);orbitCtx.stroke();const satX=center.x+Math.cos(angle)*80,satY=center.y+Math.sin(angle)*80;orbitCtx.fillStyle="#22c55e";orbitCtx.beginPath();orbitCtx.arc(satX,satY,5,0,Math.PI*2);orbitCtx.fill();angle+=0.01;}
setInterval(drawOrbit,30);

// --- 3D Orbit Renderer ---
async function start3DOrbit(){const canvas3D=document.getElementById("orbit-3d");const adapter=await navigator.gpu.requestAdapter();const device=await adapter.requestDevice();
const context=canvas3D.getContext("webgpu");const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:"opaque"});
const shader=device.createShaderModule({code:`struct Uniforms{mvp:mat4x4<f32>};@binding(0) @group(0) var<uniform> uniforms:Uniforms;struct VSOut{@builtin(position) pos:vec4<f32>;};@vertex fn vs_main(@location(0) position:vec3<f32>)->VSOut{var out:VSOut; out.pos=uniforms.mvp*vec4<f32>(position,1.0); return out;}@fragment fn fs_main()->@location(0) vec4<f32>{return vec4<f32>(0.13,0.8,0.55,1.0);}`});
const pipeline=device.createRenderPipeline({layout:"auto",vertex:{module:shader,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:shader,entryPoint:"fs_main",targets:[{format}]},primitive:{topology:"line-strip"}});
const points=[];const radius=0.7;for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;points.push(Math.cos(a)*radius,Math.sin(a)*radius,0);}
const vertexBuffer=device.createBuffer({size:points.length*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
device.queue.writeBuffer(vertexBuffer,0,new Float32Array(points));
const uniformBuffer=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniformBuffer}}]});
function mat4Perspective(fov,aspect,near,far){const f=1.0/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,(2*far*near)/(near-far),0]);}
let angle3D=0;function frame(){angle3D+=0.01;const aspect=canvas3D.clientWidth/canvas3D.clientHeight;const proj=mat4Perspective(1.2,aspect,0.1,10);proj[0]=Math.cos(angle3D);proj[1]=Math.sin(angle3D);proj[4]=-Math.sin(angle3D);proj[5]=Math.cos(angle3D);device.queue.writeBuffer(uniformBuffer,0,proj);
const encoder=device.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:{r:0.02,g:0.02,b:0.08,a:1},loadOp:"clear",storeOp:"store"}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.setVertexBuffer(0,vertexBuffer);pass.draw(points.length/3);pass.end();device.queue.submit([encoder.finish()]);requestAnimationFrame(frame);}
requestAnimationFrame(frame);logEvent("3D orbit renderer started.");}
start3DOrbit();

// --- Engine Init (Wasm) ---
async function startEngine(){const status=document.getElementById("status-text");if(!navigator.gpu){status.innerText="❌ WebGPU not supported";return;}await init("./pkg/sat_dashboard_wasm_bg.wasm");status.innerText="✅ Engine Ready";logEvent("WebGPU engine initialized.");}
startEngine();
