import fs from 'node:fs';
import vm from 'node:vm';
const target = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(target, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const pdfScript = fs.readFileSync(new URL('../public/vendor/pdf-lib.min.js', import.meta.url), 'utf8');
const inlineApp = scripts.find(script => script.includes("const STORAGE_KEY"));
if(!inlineApp) throw new Error('No se encontró el código principal de la aplicación.');
let appScript = inlineApp.replace(
  /\}\)\(\);\s*$/,
  `globalThis.__test={
    createSession, prepareSession, renderSetup, openSession, navigate, pauseTimers, sharedPdfContent, privatePdfContent, downloadPdf,
    decideParking, renderParkingAlert, closingChecklist, sessionProgressPercent, templateSteps, workflowSections,
    stageHtml(){return renderStage();},
    setupHtml(){renderSetup();return app.innerHTML;},
    timerIsRunning(){return timerRunning;},
    currentTimer(){return session.timers[currentStepId];},
    setSession(value){session=value;view='session';currentStepId=enabledSteps()[0]?.id;}
  };})();`
);

const storage = new Map();
let downloadedBlob = null;
let downloadedName = '';
const handlers = {};
const classList = { add(){}, remove(){}, toggle(){}, contains(){return false;} };
const generic = {
  textContent:'', value:'', innerHTML:'', style:{}, classList, dataset:{}, disabled:false,
  addEventListener(type,fn){handlers[type]=fn;},
  querySelector(){return generic;}, querySelectorAll(){return [];},
  appendChild(){}, append(){}, replaceChildren(){}, remove(){}, focus(){},
  click(){downloadedName=this.download||'';}
};
const app = {...generic,addEventListener(type,fn){handlers[`app:${type}`]=fn;}};
const document = {
  body:generic,
  activeElement:generic,
  getElementById(id){return id==='app'?app:generic;},
  createElement(){return {...generic};},
  addEventListener(){},
  querySelectorAll(){return [];}
};
const localStorage = {
  getItem(key){return storage.get(key)||null;},
  setItem(key,value){storage.set(key,String(value));},
  removeItem(key){storage.delete(key);}
};
const urlApi = {
  createObjectURL(blob){downloadedBlob=blob;return 'blob:test';},
  revokeObjectURL(){}
};
const window = {addEventListener(){},dispatchEvent(){},scrollTo(){}};
class CustomEventMock{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
const context = {
  console, document, localStorage, window, Blob, URL:urlApi,
  location:{protocol:'file:',origin:'null'},
  Date, Intl, Math, JSON, CustomEvent:CustomEventMock, structuredClone,
  setTimeout, clearTimeout, setInterval, clearInterval,
  confirm(){return true;}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(pdfScript,context,{filename:'pdf-lib.js'});
window.PDFLib=context.PDFLib;
vm.runInContext(appScript,context,{filename:'app.js'});

const preparedSession=context.__test.createSession('regular');
context.__test.prepareSession(preparedSession);
if(context.__test.timerIsRunning()) throw new Error('El cronómetro comenzó durante la preparación.');
const setupMarkup=context.__test.setupHtml();
if(!setupMarkup.includes('Comenzar conversación')) throw new Error('La preparación no ofrece una acción clara para comenzar.');
if(setupMarkup.includes('setupPurpose')||setupMarkup.includes('Propósito de esta sesión')) throw new Error('El propósito todavía se solicita durante la preparación.');

const firstSession=context.__test.createSession('primera');
const growthSession=context.__test.createSession('crecimiento');
const difficultSession=context.__test.createSession('dificil');
if(!firstSession.agenda.some(step=>step.id==='primeraExpectativas')||firstSession.agenda.some(step=>step.id==='feedbackTuyo')) throw new Error('La primera sesión todavía reutiliza el flujo regular de feedback.');
if(!growthSession.agenda.some(step=>step.id==='crecimientoExperimentos')||growthSession.agenda.some(step=>step.id==='seguimiento')) throw new Error('El flujo de crecimiento no tiene una agenda propia.');
if(difficultSession.agenda[0]?.id!=='dificilPreparacion'||!difficultSession.agenda.some(step=>step.id==='dificilCausas')) throw new Error('La conversación difícil no sigue la secuencia especializada.');
context.__test.setSession(difficultSession);
const difficultMarkup=context.__test.stageHtml();
if(!difficultMarkup.includes('¿Qué tipo de situación quieres abordar?')) throw new Error('La conversación difícil no permite identificar el tipo de situación.');
if(!difficultMarkup.includes('Tensión o conflicto interpersonal')) throw new Error('El conflicto no está integrado como subtipo de conversación difícil.');
difficultSession.workflow.dificilPreparacion={tipo:'conflicto',hechos:'Dos entregas llegaron después de la fecha acordada.',proposito:'Aclarar lo ocurrido.',resultado:'Acordar una forma de trabajo.'};
difficultSession.workflow.dificilApertura={mensaje:'Quiero comprender lo ocurrido y acordar un camino.',intencion:'Resolver la situación con claridad.'};
context.__test.setSession(difficultSession);
const difficultShared=JSON.stringify(context.__test.sharedPdfContent());
if(!difficultShared.includes('Quiero comprender lo ocurrido')) throw new Error('El PDF no se adapta al flujo de conversación difícil.');
if(difficultShared.includes('Dos entregas llegaron')) throw new Error('La preparación privada se filtró al PDF compartible.');
if(!JSON.stringify(context.__test.privatePdfContent()).includes('Tensión o conflicto interpersonal')) throw new Error('El PDF privado no conserva la preparación del líder.');
if(context.__test.closingChecklist().some(item=>item.label.includes('feedback hacia el líder'))) throw new Error('El checklist especializado todavía exige pasos del flujo regular.');

const automaticSession=context.__test.createSession('regular');
context.__test.openSession(automaticSession);
if(!context.__test.timerIsRunning()) throw new Error('El cronómetro no inició automáticamente al abrir la sesión.');
const automaticBefore=context.__test.currentTimer().remaining;
await new Promise(resolve=>setTimeout(resolve,1100));
if(context.__test.currentTimer().remaining>=automaticBefore) throw new Error('La cuenta regresiva automática no avanzó.');
context.__test.pauseTimers(false);
if(!context.__test.stageHtml().includes('Modo conversación')) throw new Error('El modo conversación no aparece en el bloque activo.');
if(!context.__test.stageHtml().includes('Ver preguntas y estructura completa')) throw new Error('La estructura avanzada no permanece disponible.');
const pausedAt=context.__test.currentTimer().remaining;
await new Promise(resolve=>setTimeout(resolve,1100));
if(context.__test.currentTimer().remaining!==pausedAt) throw new Error('La pausa manual no fue respetada.');
context.__test.navigate('checkin');
if(!context.__test.timerIsRunning()) throw new Error('El cronómetro no reinició al entrar al siguiente bloque.');
context.__test.pauseTimers(false);

const customDurationSession=context.__test.createSession('regular');
customDurationSession.agenda.forEach(step=>{step.min=1;});
customDurationSession.sessionElapsed=16;
context.__test.setSession(customDurationSession);
if(context.__test.sessionProgressPercent()!==4) throw new Error('La barra temporal no respeta la duración personalizada de la agenda.');
customDurationSession.sessionElapsed=9999;
if(context.__test.sessionProgressPercent()!==100) throw new Error('La barra temporal debe limitarse al 100 %.');

const parkingSession=context.__test.createSession('regular');
parkingSession.parking=[{id:'park-test',text:'Conversar sobre prioridades',destination:'final',status:'open'}];
context.__test.setSession(parkingSession);
if(!context.__test.renderParkingAlert().includes('Hablar ahora')) throw new Error('La alerta no ofrece la decisión de hablar ahora.');
if(!context.__test.renderParkingAlert().includes('Posponer')) throw new Error('La alerta no ofrece la decisión de posponer.');
context.__test.decideParking('park-test','postponed');
if(parkingSession.parking[0].status!=='postponed') throw new Error('La decisión de posponer no se guardó.');
if(parkingSession.parking[0].destination!=='next') throw new Error('Un tema pospuesto desde el cierre no se reprogramó para la próxima sesión.');
if(!context.__test.closingChecklist().find(item=>item.label.includes('estacionamiento'))?.ok) throw new Error('El checklist no reconoció la decisión del estacionamiento.');
const followupSession=context.__test.createSession('regular',parkingSession);
if(followupSession.parking.length!==1||followupSession.parking[0].status!=='open') throw new Error('El tema pospuesto no se trasladó a la siguiente sesión.');
context.__test.setSession(parkingSession);
context.__test.decideParking('park-test','now');
context.__test.decideParking('park-test','resolved');
if(context.__test.renderParkingAlert()!=='') throw new Error('La alerta no desapareció después de tratar el tema.');

const session=context.__test.createSession('regular');
session.meta.name='Andrea';
session.meta.leader='Jaime';
session.feedbackGiven.items[0].situation='Reunión del martes';
session.feedbackGiven.items[0].behavior='Presentó tres alternativas concretas.';
session.feedbackGiven.items[0].impact='El equipo tomó una decisión más rápido.';
session.close.summary='Se reconoció el avance y se acordó mantener la preparación previa.';
session.close.privateNotes='NOTA ULTRAPRIVADA QUE NO DEBE COMPARTIRSE';
session.actions[0].description='Enviar prioridades cada lunes.';
session.actions[0].owner='lider';
session.actions[0].dueDate='2026-08-03';
session.actions[0].success='Mensaje enviado antes de las nueve.';
context.__test.setSession(session);

const sharedText=JSON.stringify(context.__test.sharedPdfContent());
if(sharedText.includes('NOTA ULTRAPRIVADA')) throw new Error('La información privada se filtró al contenido compartido.');
if(!JSON.stringify(context.__test.privatePdfContent()).includes('NOTA ULTRAPRIVADA')) throw new Error('El contenido privado no incluye la nota privada.');

await context.__test.downloadPdf('shared');
if(!downloadedBlob||downloadedBlob.size<800) throw new Error('No se generó un PDF válido.');
const expectedReportDate=session.meta.date.split('-').reverse().join('-');
if(downloadedName!==`RESUMEN DE LA SESIÓN ${expectedReportDate}.pdf`) throw new Error(`Nombre inesperado para el PDF compartible: ${downloadedName}`);
let signature=new TextDecoder().decode(new Uint8Array(await downloadedBlob.arrayBuffer()).slice(0,5));
if(signature!=='%PDF-') throw new Error('El archivo compartible no tiene firma PDF.');
const sharedSize=downloadedBlob.size;

await context.__test.downloadPdf('private');
signature=new TextDecoder().decode(new Uint8Array(await downloadedBlob.arrayBuffer()).slice(0,5));
if(signature!=='%PDF-') throw new Error('El archivo privado no tiene firma PDF.');

await context.__test.downloadPdf('full');
signature=new TextDecoder().decode(new Uint8Array(await downloadedBlob.arrayBuffer()).slice(0,5));
if(signature!=='%PDF-') throw new Error('El archivo completo no tiene firma PDF.');

console.log(`OK: tres PDFs directos generados (compartible: ${sharedSize} bytes), privacidad verificada.`);
