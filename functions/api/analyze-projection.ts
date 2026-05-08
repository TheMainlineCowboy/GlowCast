import {DETECTOR_PROMPT,Env,SAM_MODEL,dets,masks,path,rect,run,type Mask,type Point,type Polygon} from "./cv-core";

type ProjectionAnalysis={surface:{polygon:Polygon;svgPath:string};masks:Mask[];depth?:{outputUrl?:string};flattenedTemplate:{width:number;height:number;aspectRatio:"16:9"};debug:{detectorProvider:string;geometryProvider:string;segmentationProvider:string;depthProvider:string;warnings:string[]}};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body,null,2),{status,headers:{"Content-Type":"application/json"}});
const DEFAULT_DETECTOR_MODEL="adirik/grounding-dino";
function surface(){const polygon=rect(.08,.30,.86,.60);return{polygon,svgPath:path(polygon)}}
function configured(value?:string){return Boolean(value&&value!=="pending")}
async function analyze(imageDataUrl:string,env:Env,refinement?:{positivePoints?:Point[];negativePoints?:Point[];maskInsetOutsetPx?:number}){
  const warnings:string[]=[];
  let detector:any=null,segmentation:any=null,depth:any=null;
  try{detector=await run({key:env.DETECTOR_API_KEY||env.SAM2_API_KEY,api:env.DETECTOR_API_URL,model:env.DETECTOR_MODEL||DEFAULT_DETECTOR_MODEL,version:env.DETECTOR_MODEL_VERSION,input:{image:imageDataUrl,prompt:DETECTOR_PROMPT,text:DETECTOR_PROMPT,caption:DETECTOR_PROMPT,box_threshold:.25,text_threshold:.25},label:"DETECTOR"})}catch(error){warnings.push(error instanceof Error?error.message:"Detector failed.")}
  const detections=dets(detector);
  if(detections.length){
    try{segmentation=await run({key:env.SAM2_API_KEY,api:env.SAM2_API_URL,model:env.SAM2_MODEL||SAM_MODEL,version:env.SAM2_MODEL_VERSION,input:{image:imageDataUrl,boxes:detections.map(d=>d.box).filter(b=>b.length===4),box_2d:detections.map(d=>d.box).filter(b=>b.length===4),mask_limit:10,prompt:"segment detected architectural openings",points:refinement?.positivePoints??[],negative_points:refinement?.negativePoints??[]},label:"SAM2"})}catch(error){warnings.push(error instanceof Error?error.message:"SAM2 failed.")}
  }else{
    warnings.push("Skipping SAM2 because detector returned zero usable boxes.");
  }
  if(configured(env.DEPTH_MODEL)||configured(env.DEPTH_MODEL_VERSION)){
    try{depth=await run({key:env.DEPTH_API_KEY,api:env.DEPTH_API_URL,model:env.DEPTH_MODEL,version:env.DEPTH_MODEL_VERSION,input:{image:imageDataUrl},label:"DEPTH"})}catch(error){warnings.push(error instanceof Error?error.message:"Depth failed.")}
  }else{
    warnings.push("Skipping depth because DEPTH_MODEL or DEPTH_MODEL_VERSION is not configured.");
  }
  const foundMasks=masks(segmentation,detections);
  const outset=refinement?.maskInsetOutsetPx??0;
  if(outset)warnings.push(`Mask inset/outset requested: ${outset}px. Apply vector offset during rendering/export.`);
  if(!detections.length)warnings.push("Detector returned no usable door/window/fixture boxes.");
  if(!foundMasks.length)warnings.push("No usable masks returned; manual masks are required until detector succeeds.");
  return{surface:surface(),masks:foundMasks,depth:{outputUrl:typeof depth?.output==="string"?depth.output:Array.isArray(depth?.output)?depth.output[0]:undefined},flattenedTemplate:{width:1920,height:1080,aspectRatio:"16:9"},debug:{detectorProvider:(env.DETECTOR_API_KEY||env.SAM2_API_KEY)?"replicate":"missing",geometryProvider:env.GEOMETRY_API_URL?"configured but not yet used":"not used",segmentationProvider:env.SAM2_API_KEY?"replicate":"missing",depthProvider:configured(env.DEPTH_MODEL)||configured(env.DEPTH_MODEL_VERSION)?"replicate":"not configured",warnings}} satisfies ProjectionAnalysis
}
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{try{const body=await request.json() as {imageDataUrl?:string;refinement?:{positivePoints?:Point[];negativePoints?:Point[];maskInsetOutsetPx?:number}};if(!body.imageDataUrl?.startsWith("data:image/"))return json({error:"imageDataUrl is required as a data:image/* URL."},400);return json(await analyze(body.imageDataUrl,env,body.refinement))}catch(error){return json({error:error instanceof Error?error.message:"Projection analysis failed."},500)}};
