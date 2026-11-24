/* =====================  FoodBridge · Firebase edition  =====================
   Auth: Firebase email+password · Data: Cloud Firestore (real-time, shared)
   Collections:  users/{uid}  ·  donations/{id}
============================================================================= */
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,runTransaction,arrayUnion,query,where} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const configured=!String(firebaseConfig.apiKey||'').startsWith('YOUR');
let auth,fdb;
if(configured){const app=initializeApp(firebaseConfig);auth=getAuth(app);fdb=getFirestore(app)}

const DEF=[28.7041,77.1025],H=3600e3;
const now=()=>Date.now();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const ST={available:['Available','#16a34a'],claimed:['Claimed by NGO','#2563eb'],assigned:['Volunteer on the way','#d97706'],picked:['Picked up · in transit','#7c3aed'],delivered:['Delivered','#0f766e'],expired:['Expired','#6b7280'],cancelled:['Cancelled','#6b7280']};
const ROLE={donor:'Food Donor',volunteer:'Volunteer',ngo:'NGO / Organization',admin:'Admin'};
const DEFTAB={donor:'new',ngo:'browse',volunteer:'tasks',admin:'overview'};
const errMsg=e=>({'auth/invalid-credential':'Wrong email or password','auth/wrong-password':'Wrong email or password','auth/user-not-found':'No account with this email','auth/email-already-in-use':'Email already registered','auth/weak-password':'Password must be at least 6 characters','auth/too-many-requests':'Too many attempts — try again later','permission-denied':'Not allowed (are you verified?)'}[e&&e.code]||(e&&e.message)||'Something went wrong');

/* ---------- state ---------- */
let authUser=null,me=null,ready=false,view='home',tab=null,mapQ=[],maps=[];
let usersMap=new Map(),donations=[],profileUnsub=null,dataUnsubs=[],lastSig='';
const users=()=>[...usersMap.values()];
const U=id=>usersMap.get(id);
const D=id=>donations.find(d=>d.id===id);
const dref=id=>doc(fdb,'donations',id);

function applyExpiry(){let ch=false;donations.forEach(d=>{if(['available','claimed'].includes(d.status)&&d.expiresAt<now()){d.status='expired';ch=true}});return ch}
function km(a,b,c,d){const R=6371,r=x=>x*Math.PI/180,dl=r(c-a),dn=r(d-b),x=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
const fmtT=t=>new Date(t).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function left(t){const m=Math.round((t-now())/60000);if(m<=0)return 'expired';return m>=60?Math.floor(m/60)+'h '+(m%60)+'m left':m+' min left'}
function toast(m){const t=document.createElement('div');t.textContent=m;$('#toast').appendChild(t);setTimeout(()=>t.remove(),3500)}
const logEntry=msg=>arrayUnion({t:now(),msg});

/* ---------- auth + live data ---------- */
if(configured){
  onAuthStateChanged(auth,u=>{
    authUser=u;stopData();if(profileUnsub){profileUnsub();profileUnsub=null}
    me=null;usersMap=new Map();donations=[];
    if(!u){ready=true;if(view=='dash')view='home';tab=null;return render()}
    profileUnsub=onSnapshot(doc(fdb,'users',u.uid),s=>{
      const was=me;me=s.exists()?{id:s.id,...s.data()}:null;ready=true;
      if(me){usersMap.set(me.id,me);
        if(!was||was.verified!==me.verified||was.role!==me.role)startData();
        if(!was){view='dash';tab=null}}
      refresh(true)
    },e=>{console.error(e);ready=true;toast(errMsg(e));render()});
  });
}
function stopData(){dataUnsubs.forEach(f=>f());dataUnsubs=[]}
function startData(){
  stopData();if(!me)return;
  const bad=e=>{console.error(e);toast(errMsg(e))};
  const q=me.role=='admin'?collection(fdb,'users'):query(collection(fdb,'users'),where('verified','==',true));
  dataUnsubs.push(onSnapshot(q,s=>{usersMap=new Map(s.docs.map(x=>[x.id,{id:x.id,...x.data()}]));if(me)usersMap.set(me.id,me);refresh()},bad));
  if(me.verified)dataUnsubs.push(onSnapshot(collection(fdb,'donations'),s=>{
    donations=s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>b.createdAt-a.createdAt);applyExpiry();refresh()},bad));
  else donations=[];
}
const sig=()=>JSON.stringify([view,tab,me&&[me.id,me.role,me.verified],users().map(u=>[u.id,u.verified]),donations.map(d=>[d.id,d.status,d.volunteerId,d.ngoId,(d.log||[]).length])]);
function busy(){const a=document.activeElement;return !!$('#modal')||(a&&a.matches&&a.matches('input,textarea,select'))||view=='login'||view=='register'||(view=='dash'&&tab=='new')}
function refresh(force){if(!force&&(sig()===lastSig||busy()))return;render()}
setInterval(()=>{if(applyExpiry())lastSig='';refresh()},15000);

/* ---------- navigation ---------- */
function go(v,t){view=v;if(t)tab=t;render();scrollTo(0,0)}
async function logout(){stopLive();closeTrack();if(auth)await signOut(auth);view='home';tab=null}
function setTab(t){tab=t;render()}

/* ---------- render ---------- */
function render(){
  lastSig=sig();
  maps.forEach(m=>{try{m.remove()}catch(e){}});maps=[];mapQ=[];
  if(me&&(view=='login'||view=='register'))view='dash';
  if(view=='dash'&&me&&!tab)tab=DEFTAB[me.role];
  let body='';
  if(!configured)body=setupV();
  else if(!ready)body=`<div class="wrap"><div class="empty">Loading…</div></div>`;
  else if(authUser&&!me)body=`<div class="wrap"><div class="card auth"><h3>Setting up your profile…</h3><p class="sub">If this stays here, your profile may have been removed by an admin.</p><button class="btn d" onclick="logout()">Logout</button></div></div>`;
  else if(view=='login')body=loginV();else if(view=='register')body=regV();else if(view=='dash'&&me)body=dash();else body=home();
  $('#app').innerHTML=nav()+body+`<footer><div class="wrap">🍲 FoodBridge — Bridging surplus food and hungry stomachs. Zero waste, zero hunger.</div></footer>`;
  mapQ.forEach(f=>f());
}
function nav(){
  return `<nav><div class="wrap"><div class="brand" onclick="go(me?'dash':'home')">🍲 FoodBridge</div><div class="nav-r">`+
  (me?`<span style="font-size:.9rem">👤 ${esc(me.name)} <span class="chip">${ROLE[me.role]}</span></span><button class="btn o s" onclick="go('dash')">Dashboard</button><button class="btn s d" onclick="logout()">Logout</button>`
  :configured?`<button class="btn o s" onclick="go('login')">Login</button><button class="btn s" onclick="go('register')">Join now</button>`:'')+`</div></div></nav>`;
}
function setupV(){
  return `<div class="wrap"><div class="card setup"><h2 class="t">One-time Firebase setup</h2><p class="sub">FoodBridge needs a (free) Firebase project to store shared data.</p><ol>
  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> → create a project.</li>
  <li><b>Build → Authentication</b> → Get started → enable <b>Email/Password</b>.</li>
  <li><b>Build → Firestore Database</b> → Create database.</li>
  <li><b>Project settings → Your apps → Web (&lt;/&gt;)</b> → register → copy the config into <code>firebase-config.js</code>.</li>
  <li>Copy <code>firestore.rules</code> into Firestore → Rules → Publish.</li>
  <li>Reload this page (serve it over http, e.g. <code>npx serve</code> — not by double-clicking).</li></ol>
  <p>See README.md for creating the first admin.</p></div></div>`;
}
function home(){
  return `<div class="hero"><div class="wrap"><h1>Don't waste food.<br>Feed someone tonight.</h1>
  <p>Hotels, restaurants, PGs and hostels post their leftover food in seconds. Verified NGOs claim it and volunteers deliver it — with live tracking all the way.</p>
  <button class="btn" onclick="go('register')">Donate / Join</button> <button class="btn o" onclick="go('login')">Login</button></div></div>
  <div class="wrap"><div class="stats">
   <div class="stat"><b>✅</b><span>Every partner is verified</span></div>
   <div class="stat"><b>📡</b><span>Live delivery tracking</span></div>
   <div class="stat"><b>⚡</b><span>Real-time food alerts</span></div>
   <div class="stat"><b>🆓</b><span>Free for everyone</span></div></div>
  <section class="blk"><h2 class="t">How FoodBridge works</h2><p class="sub">From surplus to a meal in four simple steps.</p>
   <div class="grid steps"><div class="card"><div class="ico">📝</div><b>Donor posts food</b><p>Add what's left, servings, pickup point on the map and the safe-to-eat time.</p></div>
   <div class="card"><div class="ico">🏢</div><b>NGO claims it</b><p>Nearby verified NGOs see it instantly and claim what they can serve.</p></div>
   <div class="card"><div class="ico">🛵</div><b>Volunteer picks up</b><p>A volunteer accepts the task and shares live GPS location while delivering.</p></div>
   <div class="card"><div class="ico">❤️</div><b>People are fed</b><p>Everyone can track the journey live until the food is delivered.</p></div></div></section>
  <section class="blk"><h2 class="t">Four roles, one mission</h2><p class="sub">Pick how you want to help.</p>
   <div class="grid">
   <div class="card h"><div class="ico">🏨</div><b>Food Donor</b><p>Hotels, restaurants, PGs, hostels, caterers & canteens with surplus food.</p></div>
   <div class="card h"><div class="ico">🤝</div><b>NGO / Organization</b><p>Browse nearby food on a live map and claim it for people in need.</p></div>
   <div class="card h"><div class="ico">🚴</div><b>Volunteer</b><p>Pick up from donors and deliver to NGOs. Share your live location.</p></div>
   <div class="card h"><div class="ico">🛡️</div><b>Admin</b><p>Verifies every donor, NGO and volunteer and keeps the platform safe.</p></div></div></section></div>`;
}
function loginV(){
  return `<div class="wrap"><div class="card auth"><h2 class="t">Welcome back</h2><p class="sub">Login to your FoodBridge account</p>
  <form onsubmit="doLogin(event)"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="pass" type="password" required>
  <button class="btn" style="width:100%;margin-top:16px">Login</button></form>
  <p style="margin-top:12px;text-align:center"><a href="#" onclick="resetPw();return false">Forgot password?</a> · New here? <a href="#" onclick="go('register');return false">Create account</a></p></div></div>`;
}
async function doLogin(e){e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector('button');b.disabled=true;
  try{await signInWithEmailAndPassword(auth,f.get('email').trim(),f.get('pass'));tab=null}catch(err){toast(errMsg(err));b.disabled=false}}
async function resetPw(){const em=prompt('Enter your account email:');if(!em)return;
  try{await sendPasswordResetEmail(auth,em.trim());toast('Password reset email sent')}catch(err){toast(errMsg(err))}}

function picker(id,lat,lng){
  mapQ.push(()=>{const m=L.map(id).setView([lat,lng],13);maps.push(m);tiles(m);
    const mk=L.marker([lat,lng],{icon:ic('📍')}).addTo(m);
    const set=(la,ln)=>{mk.setLatLng([la,ln]);$('#'+id+'-lat').value=la;$('#'+id+'-lng').value=ln};
    m.on('click',e=>set(e.latlng.lat,e.latlng.lng));
    window['pick_'+id]=()=>{if(!navigator.geolocation)return toast('Geolocation not supported');navigator.geolocation.getCurrentPosition(p=>{set(p.coords.latitude,p.coords.longitude);m.setView([p.coords.latitude,p.coords.longitude],15)},()=>toast('Location permission denied'))};
    setTimeout(()=>m.invalidateSize(),200)});
  return `<div style="display:flex;justify-content:space-between;align-items:center"><label style="margin:0">Pin location on map (click map to move pin)</label><button type="button" class="btn o s" onclick="pick_${id}()">📍 Use my location</button></div>
  <div id="${id}" class="map"></div><input type="hidden" id="${id}-lat" name="lat" value="${lat}"><input type="hidden" id="${id}-lng" name="lng" value="${lng}">`;
}
function regV(){
  return `<div class="wrap"><div class="card auth" style="max-width:640px"><h2 class="t">Join FoodBridge</h2><p class="sub">New accounts are verified by our admin before they can act.</p>
  <form onsubmit="doReg(event)"><label>I am a</label><select name="role" onchange="document.getElementById('dt').style.display=this.value=='donor'?'block':'none'">
   <option value="donor">Food Donor (Hotel / Restaurant / PG / Hostel)</option><option value="ngo">NGO / Organization</option><option value="volunteer">Volunteer</option></select>
  <div id="dt"><label>Donor type</label><select name="donorType"><option>Hotel</option><option>Restaurant</option><option>PG / Hostel</option><option>Caterer</option><option>Canteen / Mess</option><option>Other</option></select></div>
  <div class="row"><div><label>Full name</label><input name="name" required></div><div><label>Organization / Business (optional for volunteers)</label><input name="org"></div></div>
  <div class="row"><div><label>Email</label><input name="email" type="email" required></div><div><label>Phone</label><input name="phone" pattern="[0-9+ ]{8,15}" required></div></div>
  <label>Password (min 6 characters)</label><input name="pass" type="password" minlength="6" required>
  <label>Address</label><input name="address" required>
  ${picker('rmap',DEF[0],DEF[1])}
  <button class="btn" style="width:100%;margin-top:16px">Create account</button></form>
  <p style="margin-top:12px;text-align:center">Already registered? <a href="#" onclick="go('login');return false">Login</a></p></div></div>`;
}
async function doReg(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),b=e.target.querySelector('button');b.disabled=true;
  try{
    const c=await createUserWithEmailAndPassword(auth,f.email.trim(),f.pass);
    await setDoc(doc(fdb,'users',c.user.uid),{role:f.role,name:f.name.trim(),email:f.email.trim(),phone:f.phone,org:f.org||'',donorType:f.role=='donor'?f.donorType:'',address:f.address,lat:+f.lat,lng:+f.lng,verified:false,createdAt:now()});
    toast('Account created! Waiting for admin verification.');
  }catch(err){toast(errMsg(err));b.disabled=false}}

/* ---------- dashboard ---------- */
function dash(){
  const R = me?.role;

  const menuOptions = {
    donor: [['new','➕ Post food'],['mine','📦 My donations']],
    ngo: [['browse','🗺️ Find food'],['active','🚚 My claims'],['history','✅ History']],
    volunteer: [['tasks','📋 Open tasks'],['mine','🛵 My deliveries']],
    admin: [['overview','📊 Overview'],['users','👥 Users'],['donations','🍱 All donations']]
  };

  const menus = menuOptions[R];

  if (!menus) {
    return `<div class="wrap"><div class="card">
      <h3>Account loading issue</h3>
      <p>Your user role is missing or invalid.</p>
      <p>Current role: ${esc(String(R))}</p>
    </div></div>`;
  }

  let c = '';

  if(R=='donor') c=tab=='new'?donorNew():donorMine();
  else if(R=='ngo') c=tab=='browse'?ngoBrowse():ngoList(tab=='history');
  else if(R=='volunteer') c=tab=='tasks'?volTasks():volMine();
  else c=tab=='overview'?adminOv():tab=='users'?adminUsers():adminDon();

  const warn=(!me.verified&&R!='admin')
    ?`<div class="alert">⏳ Your account is <b>awaiting admin verification</b>. Once approved you can post, claim and accept food. This page updates automatically.</div>`
    :'';

  return `<div class="wrap"><div class="dash"><aside class="side">
    <div class="me">
      <b>${esc(me.name)}</b>
      <small>${ROLE[R]}${me.org?' · '+esc(me.org):''}</small>
      <small>${me.verified?'✅ Verified':'⏳ Pending'}</small>
    </div>
    ${menus.map(m=>`<button class="${tab==m[0]?'on':''}" onclick="setTab('${m[0]}')">${m[1]}</button>`).join('')}
    </aside><main>${warn}${c}</main></div></div>`;
}
const badge=s=>`<span class="badge" style="background:${ST[s][1]}">${ST[s][0]}</span>`;
function dcard(d,acts){
  const dn=U(d.donorId),ngo=d.ngoId?U(d.ngoId):null,vol=d.volunteerId?U(d.volunteerId):null;
  const dist=me&&me.lat?` · 📏 ${km(me.lat,me.lng,d.lat,d.lng).toFixed(1)} km from you`:'';
  return `<div class="card dcard"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><h4>${esc(d.title)}</h4>${badge(d.status)}</div>
  <div><span class="chip">${d.type=='Veg'?'🟢':d.type=='Non-veg'?'🔴':'🟡'} ${esc(d.type)}</span><span class="chip">🍽️ ${esc(d.servings)} servings</span><span class="chip">${esc(d.category)}</span><span class="chip">⏱️ ${left(d.expiresAt)}</span></div>
  <div style="font-size:.9rem">${esc(d.items)}</div>
  <div style="font-size:.85rem;color:var(--mu)">🏢 ${esc(dn?dn.org||dn.name:'')} · 📍 ${esc(d.address)}${dist}<br>📞 ${esc(d.phone)} · Posted ${fmtT(d.createdAt)}
  ${ngo?`<br>🤝 NGO: ${esc(ngo.org||ngo.name)}`:''}${vol?`<br>🛵 Volunteer: ${esc(vol.name)} (${esc(vol.phone)})`:''}</div>
  <div class="acts">${acts||''}</div></div>`;
}
const trackBtn=d=>['claimed','assigned','picked','delivered'].includes(d.status)?`<button class="btn b s" onclick="openTrack('${d.id}')">📡 Live track</button>`:'';
const empty=m=>`<div class="card empty">${m}</div>`;
const need=()=>me.verified?'':'disabled';
const G='style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))"';

/* donor */
function donorNew(){
  return `<h2 class="t">Post surplus food</h2><p class="sub">Fill in the details — nearby NGOs see it instantly.</p>
  <form class="card" onsubmit="postDon(event)"><div class="row"><div><label>Food title</label><input name="title" placeholder="e.g. Veg biryani & raita" required></div>
  <div><label>Category</label><select name="category"><option>Cooked meal</option><option>Bakery / Snacks</option><option>Packaged food</option><option>Fruits & vegetables</option><option>Sweets</option></select></div></div>
  <label>What exactly is available?</label><textarea name="items" rows="2" required></textarea>
  <div class="row"><div><label>Approx. servings (people it can feed)</label><input name="servings" type="number" min="1" required></div>
  <div><label>Food type</label><select name="type"><option>Veg</option><option>Non-veg</option><option>Both</option></select></div></div>
  <div class="row"><div><label>Safe to eat for next</label><select name="hours"><option value="1">1 hour</option><option value="2">2 hours</option><option value="4" selected>4 hours</option><option value="6">6 hours</option><option value="12">12 hours</option></select></div>
  <div><label>Contact phone</label><input name="phone" value="${esc(me.phone)}" required></div></div>
  <label>Pickup address</label><input name="address" value="${esc(me.address)}" required>
  ${picker('dmap',me.lat||DEF[0],me.lng||DEF[1])}
  <button class="btn" style="margin-top:16px" ${need()}>Post donation</button></form>`;
}
async function postDon(e){e.preventDefault();if(!me.verified)return toast('Wait for admin verification');
  const f=Object.fromEntries(new FormData(e.target)),b=e.target.querySelector('button');b.disabled=true;
  try{await setDoc(doc(collection(fdb,'donations')),{donorId:me.id,title:f.title,items:f.items,servings:+f.servings,type:f.type,category:f.category,phone:f.phone,address:f.address,lat:+f.lat,lng:+f.lng,createdAt:now(),expiresAt:now()+(+f.hours)*H,status:'available',ngoId:null,volunteerId:null,vloc:null,log:[{t:now(),msg:'Donation posted by '+(me.org||me.name)}]});
    toast('Donation posted! NGOs can now see it.');tab='mine';render()}catch(err){toast(errMsg(err));b.disabled=false}}
function donorMine(){
  const l=donations.filter(d=>d.donorId==me.id);
  return `<h2 class="t">My donations</h2><p class="sub">${l.length} total · ${l.filter(d=>d.status=='delivered').reduce((a,d)=>a+ +d.servings,0)} meals delivered</p>
  <div class="grid" ${G}>${l.map(d=>dcard(d,trackBtn(d)+(d.status=='available'?`<button class="btn d s" onclick="setSt('${d.id}','cancelled','Cancelled by donor')">Cancel</button>`:''))).join('')||empty('No donations yet. Post your first surplus food!')}</div>`;
}

/* NGO */
function ngoBrowse(){
  const l=donations.filter(d=>d.status=='available').sort((a,b)=>km(me.lat,me.lng,a.lat,a.lng)-km(me.lat,me.lng,b.lat,b.lng));
  mapQ.push(()=>{const m=L.map('bmap').setView([me.lat||DEF[0],me.lng||DEF[1]],12);maps.push(m);tiles(m);
    L.marker([me.lat,me.lng],{icon:ic('🏢')}).addTo(m).bindPopup('Your organization');
    l.forEach(d=>L.marker([d.lat,d.lng],{icon:ic('🍲')}).addTo(m).bindPopup(`<b>${esc(d.title)}</b><br>${esc(d.servings)} servings<br><a href="#" onclick="claim('${d.id}');return false">Claim this food</a>`));
    setTimeout(()=>m.invalidateSize(),200)});
  return `<h2 class="t">Food available near you</h2><p class="sub">Sorted by distance from your organization. Updates live.</p><div id="bmap" class="map tall" style="margin-bottom:18px"></div>
  <div class="grid" ${G}>${l.map(d=>dcard(d,`<button class="btn s" ${need()} onclick="claim('${d.id}')">✋ Claim food</button>`)).join('')||empty('No food available right now. Check back soon!')}</div>`;
}
async function claim(id){if(!me.verified)return toast('Wait for admin verification');
  try{await runTransaction(fdb,async tx=>{const r=dref(id),s=await tx.get(r),d=s.data();
      if(!d||d.status!=='available'||d.expiresAt<now())throw new Error('Already claimed or expired');
      tx.update(r,{status:'claimed',ngoId:me.id,log:logEntry('Claimed by '+(me.org||me.name)+' — waiting for a volunteer')})});
    toast('Claimed! A volunteer will be assigned.');tab='active';render()}catch(e){toast(errMsg(e))}}
function ngoList(hist){
  const l=donations.filter(d=>d.ngoId==me.id&&(hist?['delivered','expired','cancelled'].includes(d.status):['claimed','assigned','picked'].includes(d.status)));
  return `<h2 class="t">${hist?'Delivery history':'My active claims'}</h2><p class="sub">${hist?'Everything you have received.':'Track your incoming food live.'}</p>
  <div class="grid" ${G}>${l.map(d=>dcard(d,trackBtn(d))).join('')||empty('Nothing here yet.')}</div>`;
}

/* volunteer */
function volTasks(){
  const l=donations.filter(d=>d.status=='claimed'&&!d.volunteerId).sort((a,b)=>km(me.lat,me.lng,a.lat,a.lng)-km(me.lat,me.lng,b.lat,b.lng));
  return `<h2 class="t">Open pickup tasks</h2><p class="sub">Food claimed by NGOs that needs a volunteer.</p>
  <div class="grid" ${G}>${l.map(d=>{const n=U(d.ngoId);return dcard(d,(n?`<span style="font-size:.85rem;color:var(--mu);width:100%">➡️ Deliver to ${esc(n.org||n.name)}, ${esc(n.address)} (${km(d.lat,d.lng,n.lat,n.lng).toFixed(1)} km trip)</span>`:'')+`<button class="btn s" ${need()} onclick="accept('${d.id}')">🛵 Accept task</button>`)}).join('')||empty('No open tasks. Thank you for being ready!')}</div>`;
}
async function accept(id){if(!me.verified)return toast('Wait for admin verification');
  try{await runTransaction(fdb,async tx=>{const r=dref(id),s=await tx.get(r),d=s.data();
      if(!d||d.status!=='claimed'||d.volunteerId)throw new Error('Task already taken');
      tx.update(r,{status:'assigned',volunteerId:me.id,vloc:{lat:me.lat,lng:me.lng,t:now()},log:logEntry('Volunteer '+me.name+' accepted the task and is heading to the pickup point')})});
    tab='mine';render()}catch(e){toast(errMsg(e))}}
function volMine(){
  const l=donations.filter(d=>d.volunteerId==me.id);
  return `<h2 class="t">My deliveries</h2><p class="sub">Share your live location so donor and NGO can follow you.</p>
  <div class="grid" ${G}>${l.map(d=>{let a=trackBtn(d);
    if(d.status=='assigned')a+=`<button class="btn w s" onclick="setSt('${d.id}','picked','Food picked up from donor — on the way to NGO')">✅ Mark picked up</button>`;
    if(d.status=='picked')a+=`<button class="btn s" onclick="setSt('${d.id}','delivered')">🎉 Mark delivered</button>`;
    if(['assigned','picked'].includes(d.status))a+=`<button class="btn o s" onclick="startGPS('${d.id}')">📡 Share live GPS</button><button class="btn o s" onclick="startSim('${d.id}')">▶ Simulate trip</button><button class="btn o s" onclick="stopLive();toast('Stopped sharing')">⏹ Stop</button>`;
    return dcard(d,a)}).join('')||empty('You have no deliveries yet. Accept a task to begin.')}</div>`;
}
async function setSt(id,s,msg){const d=D(id);if(!d)return;
  if(!msg){const n=U(d.ngoId);msg='Food delivered to '+(n?n.org||n.name:'NGO')}
  try{await updateDoc(dref(id),{status:s,log:logEntry(msg)});if(['delivered','cancelled'].includes(s))stopLive();toast(ST[s][0])}catch(e){toast(errMsg(e))}}

/* admin */
function adminOv(){
  const pend=users().filter(u=>!u.verified&&u.role!='admin');
  const c=r=>users().filter(u=>u.role==r).length;
  return `<h2 class="t">Admin overview</h2><p class="sub">Keep the platform trusted and active.</p>
  <div class="grid" style="margin-bottom:22px">
   <div class="stat"><b>${c('donor')}</b><span>Donors</span></div><div class="stat"><b>${c('ngo')}</b><span>NGOs</span></div><div class="stat"><b>${c('volunteer')}</b><span>Volunteers</span></div>
   <div class="stat"><b>${donations.length}</b><span>Donations</span></div><div class="stat"><b>${donations.filter(d=>d.status=='delivered').reduce((a,d)=>a+ +d.servings,0)}</b><span>Meals delivered</span></div><div class="stat"><b>${pend.length}</b><span>Pending verification</span></div></div>
  <h3 style="margin-bottom:10px">Waiting for verification</h3>${pend.length?usersTable(pend):empty('All caught up 🎉')}`;
}
function usersTable(l){
  return `<div class="tw"><table><tr><th>Name</th><th>Role</th><th>Organization</th><th>Contact</th><th>Address</th><th>Status</th><th>Action</th></tr>${l.map(u=>`<tr><td>${esc(u.name)}</td><td>${ROLE[u.role]}${u.donorType?'<br><small>'+esc(u.donorType)+'</small>':''}</td><td>${esc(u.org)}</td><td>${esc(u.email)}<br>${esc(u.phone)}</td><td>${esc(u.address)}</td><td>${u.verified?'✅ Verified':'⏳ Pending'}</td>
  <td>${u.role=='admin'?'—':`<button class="btn s" onclick="verify('${u.id}')">${u.verified?'Revoke':'Verify'}</button> <button class="btn d s" onclick="delUser('${u.id}')">Remove</button>`}</td></tr>`).join('')}</table></div>`;
}
const adminUsers=()=>`<h2 class="t">All users</h2><p class="sub">Verify or remove accounts.</p>${usersTable(users())}`;
const adminDon=()=>`<h2 class="t">All donations</h2><p class="sub">Monitor every donation on the platform.</p><div class="grid" ${G}>${donations.map(d=>dcard(d,trackBtn(d)+`<button class="btn d s" onclick="delDon('${d.id}')">Delete</button>`)).join('')||empty('No donations.')}</div>`;
async function verify(id){const u=U(id);if(!u)return;try{await updateDoc(doc(fdb,'users',id),{verified:!u.verified});toast(u.verified?'Verification revoked':'User verified')}catch(e){toast(errMsg(e))}}
async function delUser(id){if(!confirm('Remove this user profile?'))return;try{await deleteDoc(doc(fdb,'users',id))}catch(e){toast(errMsg(e))}}
async function delDon(id){if(!confirm('Delete this donation?'))return;try{await deleteDoc(dref(id))}catch(e){toast(errMsg(e))}}

/* ---------- maps & live tracking ---------- */
function tiles(m){L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m)}
function ic(e){return L.divIcon({html:`<div class="pin">${e}</div>`,className:'',iconSize:[30,30],iconAnchor:[15,28],popupAnchor:[0,-24]})}
let trk=null,sim=null,gps=null,lastGps=0;
function stopLive(){if(sim)clearInterval(sim);sim=null;if(gps!=null&&navigator.geolocation)navigator.geolocation.clearWatch(gps);gps=null}
function startSim(id){stopLive();toast('Simulating your trip…');
  sim=setInterval(()=>{const d=D(id);if(!d||!['assigned','picked'].includes(d.status)){stopLive();return}
    const n=U(d.ngoId);if(!n)return;
    const t=d.status=='assigned'?{lat:d.lat,lng:d.lng}:{lat:n.lat,lng:n.lng},v=d.vloc||{lat:me.lat,lng:me.lng};
    const dist=km(v.lat,v.lng,t.lat,t.lng);let nv;
    if(dist<0.08)nv={lat:t.lat,lng:t.lng};else{const k=Math.min(1,Math.max(.15,.25/dist));nv={lat:v.lat+(t.lat-v.lat)*k,lng:v.lng+(t.lng-v.lng)*k}}
    updateDoc(dref(id),{vloc:{...nv,t:now()}}).catch(e=>{stopLive();toast(errMsg(e))})},2000)}
function startGPS(id){stopLive();if(!navigator.geolocation)return toast('GPS not supported on this device');
  toast('Sharing your live GPS location…');
  gps=navigator.geolocation.watchPosition(p=>{if(now()-lastGps<3000)return;lastGps=now();
    updateDoc(dref(id),{vloc:{lat:p.coords.latitude,lng:p.coords.longitude,t:now()}}).catch(e=>toast(errMsg(e)))},()=>toast('Location permission denied'),{enableHighAccuracy:true,maximumAge:2000})}
function openTrack(id){closeTrack();
  const m=document.createElement('div');m.className='modal';m.id='modal';
  m.innerHTML=`<div class="mbox"><button class="x" onclick="closeTrack()">✕</button><h3 style="margin-bottom:8px">📡 Live tracking</h3><div id="tinfo"></div><div id="tmap" class="map tall"></div><div style="font-size:.8rem;color:var(--mu);margin-top:6px">🍲 Donor pickup · 🏢 NGO drop · 🛵 Volunteer (live)</div><div id="tlog" class="log"></div></div>`;
  document.body.appendChild(m);
  const map=L.map('tmap');tiles(map);trk={id,map,mk:{},line:null,fit:false};
  trk.timer=setInterval(updTrack,1000);updTrack();setTimeout(()=>map.invalidateSize(),150)}
function closeTrack(){if(trk){clearInterval(trk.timer);try{trk.map.remove()}catch(e){}trk=null}const m=$('#modal');if(m)m.remove()}
function updTrack(){if(!trk)return;const d=D(trk.id);if(!d)return closeTrack();
  const n=U(d.ngoId),v=d.vloc,pts=[],T=trk;
  const put=(k,lat,lng,e,pop)=>{if(T.mk[k])T.mk[k].setLatLng([lat,lng]);else T.mk[k]=L.marker([lat,lng],{icon:ic(e)}).addTo(T.map).bindPopup(pop);pts.push([lat,lng])};
  put('d',d.lat,d.lng,'🍲','Pickup: '+esc(d.address));
  if(n)put('n',n.lat,n.lng,'🏢','Drop: '+esc(n.org||n.name));
  if(v&&['assigned','picked','delivered'].includes(d.status))put('v',v.lat,v.lng,'🛵','Volunteer');
  if(T.line)T.map.removeLayer(T.line);
  const path=[];if(v&&d.status=='assigned'){path.push([v.lat,v.lng],[d.lat,d.lng]);if(n)path.push([n.lat,n.lng])}else if(v&&d.status=='picked'&&n){path.push([v.lat,v.lng],[n.lat,n.lng])}else if(n)path.push([d.lat,d.lng],[n.lat,n.lng]);
  T.line=L.polyline(path,{color:'#16a34a',weight:4,dashArray:'8 8'}).addTo(T.map);
  if(!T.fit&&pts.length){T.map.fitBounds(pts,{padding:[40,40],maxZoom:16});T.fit=true}
  let eta='';if(v&&n&&['assigned','picked'].includes(d.status)){const tg=d.status=='assigned'?[d.lat,d.lng]:[n.lat,n.lng],ds=km(v.lat,v.lng,tg[0],tg[1]);eta=` · ${ds.toFixed(2)} km to ${d.status=='assigned'?'pickup':'NGO'} (~${Math.max(1,Math.round(ds/25*60))} min)`}
  $('#tinfo').innerHTML=`<b>${esc(d.title)}</b> ${badge(d.status)}<div style="font-size:.88rem;color:var(--mu);margin:4px 0 8px">${v?'Last update '+new Date(v.t).toLocaleTimeString():'Waiting for a volunteer…'}${eta}</div>`;
  $('#tlog').innerHTML=(d.log||[]).slice().reverse().map(l=>`<div>${esc(l.msg)}<br><small>${fmtT(l.t)}</small></div>`).join('');
}

/* inline onclick handlers need globals (ES modules are scoped) */
Object.assign(window,{go,logout,setTab,doLogin,doReg,resetPw,postDon,claim,accept,setSt,verify,delUser,delDon,openTrack,closeTrack,startSim,startGPS,stopLive,toast,render});
render();
