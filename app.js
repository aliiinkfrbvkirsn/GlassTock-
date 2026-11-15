/* GlassStock v2.0 — pricing, stock movements, reports and team roles */
const SUPABASE_URL = "https://octkotsbkhvcuxwkzopg.supabase.co";
const SUPABASE_KEY = "sb_publishable_gut8UJBnqJIOxDnBOwzAVg_80T6m7u-";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
let tab="login",currentUser=null,workspace=null,membership=null,items=[],movements=[],teamMembers=[],isPlatformAdmin=false,developerWorkspaces=[],activeDeveloperWorkspaceId=null,myHistoryRows=[],myHistoryFilter="all";
const views=["authView","setupView","appView","developerView","developerWorkspaceView"];
let closingFromPopState=false;
function showView(id){views.forEach(v=>$(v).classList.toggle("hidden",v!==id));$("logoutBtn").classList.toggle("hidden",id==="authView");syncBackButton();}
function syncBackButton(){
 const hasDialog=Array.from(document.querySelectorAll("dialog")).some(d=>d.open);
 const hasDetail=!$("developerWorkspaceView").classList.contains("hidden");
 const hasWorkspacePage=history.state?.glassstockNav==="page";
 $("backBtn").classList.toggle("hidden",!(hasDialog||hasDetail||hasWorkspacePage));
}
function openDialog(id){
 const dialog=$(id);if(!dialog||dialog.open)return;
 history.pushState({glassstockNav:"dialog",dialogId:id},"","#"+id);
 dialog.showModal();syncBackButton();
}
document.querySelectorAll("dialog").forEach(dialog=>dialog.addEventListener("close",()=>{
 if(!closingFromPopState&&history.state?.glassstockNav==="dialog"&&history.state.dialogId===dialog.id)history.back();
 syncBackButton();
}));
window.addEventListener("popstate",()=>{
 const openDialogs=Array.from(document.querySelectorAll("dialog[open]"));
 if(openDialogs.length){
  closingFromPopState=true;openDialogs[openDialogs.length-1].close();closingFromPopState=false;syncBackButton();return;
 }
 if(!$("developerWorkspaceView").classList.contains("hidden")){
  if(history.state?.page==="developerWorkspace"){syncBackButton();return;}
  showView("developerView");return;
 }
 if(isPlatformAdmin && !$("developerView").classList.contains("hidden")){
  syncBackButton();return;
 }
 syncBackButton();
});
$("backBtn").addEventListener("click",()=>{
 if(history.state?.glassstockNav==="dialog"||history.state?.glassstockNav==="page"){history.back();return;}
 const openDialogs=Array.from(document.querySelectorAll("dialog[open]"));
 if(openDialogs.length)openDialogs[openDialogs.length-1].close();
 else if(!$("developerWorkspaceView").classList.contains("hidden"))showView("developerView");
});
function msg(id,text,ok=false){const el=$(id);el.textContent=text;el.classList.toggle("success",ok);}
function toast(text){const el=$("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function setConnection(text,kind=""){const el=$("connection");el.textContent="● "+text;el.className="status "+kind;}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function normalizeSearchText(value=""){
 const aliases={"ауди":"audi","бмв":"bmw","бид":"byd","чанган":"changan","шевроле":"chevrolet","дэу":"daewoo","дайхатсу":"daihatsu","форд":"ford","хонда":"honda","хундай":"hyundai","хендай":"hyundai","киа":"kia","лексус":"lexus","ман":"man","мазда":"mazda","мерседес":"mercedes","мицубиси":"mitsubishi","ниссан":"nissan","опель":"opel","рено":"renault","шкода":"skoda","сангйонг":"ssangyong","субару":"subaru","тойота":"toyota","тайота":"toyota","таета":"toyota","тоета":"toyota","таёта":"toyota","фольксваген":"volkswagen","вольво":"volvo","ваз":"ваз","камри":"camry","королла":"corolla","прадо":"prado","рав4":"rav4","аккорд":"accord","сивик":"civic","цивик":"civic","солярис":"solaris","соната":"sonata","элантра":"elantra","крета":"creta","рио":"rio","спортейдж":"sportage","тигуан":"tiguan","пассат":"passat","гольф":"golf","джетта":"jetta","а4":"a4","а6":"a6","икс5":"x5"};
 const map={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
 return String(value).toLocaleLowerCase("ru").normalize("NFKC").replace(/ё/g,"е").split(/[^a-zа-я0-9]+/u).filter(Boolean).map(word=>aliases[word]||word.replace(/[а-я]/g,ch=>map[ch]||ch)).join(" ");
}
function money(v){return new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(Number(v||0));}
function setTab(next){tab=next;document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$("authSubmit").textContent=tab==="login"?"Войти":"Создать аккаунт";}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));

async function init(){
 setConnection("Проверка…");
 const {data:{session},error}=await db.auth.getSession();
 if(error){setConnection("Ошибка","bad");return;}
 if(session){currentUser=session.user;await routeUser();}else{showView("authView");setConnection("Не выполнен вход");}
 db.auth.onAuthStateChange((_event,session)=>{setTimeout(async()=>{currentUser=session?.user||null;if(currentUser)await routeUser();else{workspace=null;showView("authView");setConnection("Не выполнен вход");}},0);});
}
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();msg("authMessage","");$("authSubmit").disabled=true;
 const email=$("email").value.trim(),password=$("password").value;
 const result=tab==="signup"?await db.auth.signUp({email,password,options:{emailRedirectTo:"https://aliiinkfrbvkirsn.github.io/GlassTock-/"}}):await db.auth.signInWithPassword({email,password});
 $("authSubmit").disabled=false;
 if(result.error){msg("authMessage",result.error.message);return;}
 if(tab==="signup"&&!result.data.session){msg("authMessage","Аккаунт создан. Проверь почту и подтверди адрес, затем войди.",true);return;}
 currentUser=result.data.user;await routeUser();
});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();});
$("ownerLoginBtn").addEventListener("click",async()=>{setTab("login");$("password").value="";msg("authMessage","");await db.auth.signOut();showView("authView");setConnection("Вход для владельца");});

async function routeUser(){
 setConnection("Загрузка…");
 const adminResult=await db.rpc("is_platform_admin");
 isPlatformAdmin=!adminResult.error&&adminResult.data===true;
 const {data:member,error}=await db.from("workspace_members").select("workspace_id,role").eq("user_id",currentUser.id).maybeSingle();
 if(error){
  if(isPlatformAdmin){membership=null;workspace=null;showView("developerView");setConnection("Панель разработчика","ok");await renderDeveloperDashboard();return;}
  setConnection("Ошибка доступа","bad");showView("setupView");msg("setupMessage","Не удалось проверить участие: "+error.message);return;
 }
 if(!member){
  membership=null;workspace=null;
  if(isPlatformAdmin){showView("developerView");setConnection("Панель разработчика","ok");await renderDeveloperDashboard();return;}
  showView("setupView");setConnection("Нужна настройка");return;
 }
 membership=member;
 const {data:ws,error:wsErr}=await db.from("workspaces").select("id,name,join_code").eq("id",member.workspace_id).single();
 if(wsErr){showView("setupView");msg("setupMessage",wsErr.message);return;}
 workspace=ws;$("workspaceTitle").textContent=ws.name;
 $("userLabel").textContent=currentUser.email+" · "+({owner:"Владелец",manager:"Менеджер",staff:"Сотрудник"}[member.role]||"Сотрудник");
 $("teamBtn").classList.toggle("hidden",member.role!=="owner");
 $("inviteBtn").classList.toggle("hidden",member.role!=="owner");
 $("addBtn").classList.toggle("hidden",member.role==="staff");
 if(isPlatformAdmin){showView("developerView");setConnection("Разработчик · облако подключено","ok");await renderDeveloperDashboard();}
 else{showView("appView");setConnection("Облако подключено","ok");await refresh();}
}
async function renderDeveloperDashboard(){
 msg("platformMessage","Загружаю организации…");
 const [w,m,i]=await Promise.all([
  db.from("workspaces").select("id,name,created_at").order("created_at",{ascending:false}),
  db.from("workspace_members").select("workspace_id,user_id,role,created_at"),
  db.from("inventory").select("workspace_id,id,quantity")
 ]);
 const error=w.error||m.error||i.error;
 if(error){msg("platformMessage","Не удалось загрузить обзор: "+error.message);return;}
 const workspaces=w.data||[],members=m.data||[],stock=i.data||[];
 developerWorkspaces=workspaces;
 $("platformWorkspaceCount").textContent=workspaces.length;
 $("platformMemberCount").textContent=members.length;
 $("platformItemCount").textContent=stock.length;
 $("platformStockCount").textContent=stock.reduce((sum,row)=>sum+Number(row.quantity||0),0);
 $("platformMembersList").innerHTML=members.map(m=>{
  const ws=workspaces.find(x=>x.id===m.workspace_id);
  const role=m.role==="owner"?"Владелец":m.role==="manager"?"Менеджер":"Сотрудник";
  return '<div class="team-row"><div><b>'+esc(m.user_id.slice(0,8))+'…</b><small>'+esc(ws?.name||"Компания")+' · '+role+'</small></div><button class="mini" data-open-member-workspace="'+m.workspace_id+'">Открыть</button></div>';
 }).join("")||'<p class="muted">Участников пока нет.</p>';
 $("platformWorkspaceList").innerHTML=workspaces.map(ws=>{
  const team=members.filter(x=>x.workspace_id===ws.id),owner=team.find(x=>x.role==="owner");
  const products=stock.filter(x=>x.workspace_id===ws.id);
  const qty=products.reduce((sum,x)=>sum+Number(x.quantity||0),0);
  return '<div class="history-item"><div><b>'+esc(ws.name)+'</b><small>Создан: '+new Date(ws.created_at).toLocaleDateString("ru-RU")+' · Участников: '+team.length+' · Владелец: '+(owner?'есть':'не назначен')+'</small><small>Позиций: '+products.length+' · Остаток: '+qty+' шт.</small></div><button class="mini" data-open-workspace="'+ws.id+'">Просмотреть</button></div>';
 }).join("")||'<p class="muted">Пока нет созданных компаний.</p>';
 msg("platformMessage","Данные обновлены.",true);
}
async function loadMyHistory(){
 $("myHistoryUser").textContent=(currentUser.email||"")+" · "+(workspace?.name||"");
 $("myHistoryMessage").textContent="Загружаю историю…";
 $("myHistoryList").innerHTML="";
 const {data,error}=await db.from("stock_movements").select("id,user_id,movement_type,quantity,note,created_at,unit_price,inventory(make,model,part_number)").eq("workspace_id",workspace.id).eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(2000);
 if(error){$("myHistoryMessage").textContent="Не удалось загрузить историю: "+error.message;return;}
 myHistoryRows=data||[];
 $("myHistoryIn").textContent=myHistoryRows.filter(x=>x.movement_type==="in").reduce((n,x)=>n+Number(x.quantity||0),0);
 $("myHistoryOut").textContent=myHistoryRows.filter(x=>x.movement_type==="out").reduce((n,x)=>n+Number(x.quantity||0),0);
 $("myHistoryCount").textContent=myHistoryRows.length;
 $("myHistoryMessage").textContent=myHistoryRows.length?"Здесь показаны только твои действия.":"Пока у тебя нет сохранённых операций.";
 renderMyHistory();
}
function renderMyHistory(){
 document.querySelectorAll("[data-my-history-filter]").forEach(b=>b.classList.toggle("active",b.dataset.myHistoryFilter===myHistoryFilter));
 const rows=myHistoryRows.filter(m=>myHistoryFilter==="all"||m.movement_type===myHistoryFilter);
 $("myHistoryList").innerHTML=rows.map(m=>{
  const label=m.movement_type==="in"?"Пополнение":m.movement_type==="out"?"Продажа / расход":"Корректировка";
  const sign=m.movement_type==="in"?"+":m.movement_type==="out"?"−":"";
  const name=(m.inventory?.make||"Стекло")+" "+(m.inventory?.model||"");
  const details=[m.inventory?.part_number?"Артикул: "+m.inventory.part_number:"",m.note||"",m.unit_price!=null?"Цена: "+money(m.unit_price)+" сом/шт.":""].filter(Boolean).join(" · ");
  return '<div class="history-item"><div><b>'+esc(name.trim())+'</b><small>'+label+' · '+new Date(m.created_at).toLocaleString("ru-RU")+(details?" · "+esc(details):"")+'</small></div><div class="history-type '+(m.movement_type==="in"?"in":m.movement_type==="out"?"out":"adjust")+'">'+sign+money(m.quantity)+'</div></div>';
 }).join("")||'<p class="muted">В этой категории пока нет действий.</p>';
}
$("myHistoryBtn").addEventListener("click",async()=>{
 if(!workspace||!currentUser)return;
 myHistoryFilter="all";openDialog("myHistoryDialog");await loadMyHistory();
});
$("myHistoryDialog").addEventListener("click",e=>{
 const btn=e.target.closest("[data-my-history-filter]");
 if(!btn)return;
 myHistoryFilter=btn.dataset.myHistoryFilter;renderMyHistory();
});
$("openMyWorkspaceBtn").addEventListener("click",async()=>{
 if(!workspace){toast("У этого аккаунта пока нет собственного склада");return;}
 history.pushState({glassstockNav:"page",page:"myWorkspace"},"","#my-workspace");showView("appView");await refresh();
});
$("refreshPlatformBtn").addEventListener("click",renderDeveloperDashboard);
$("platformMembersCard").addEventListener("click",()=>openDialog("platformMembersDialog"));
$("platformMembersCard").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDialog("platformMembersDialog");}});
$("platformMembersList").addEventListener("click",e=>{
 const btn=e.target.closest("[data-open-member-workspace]");
 if(btn){$("platformMembersDialog").close();openDeveloperWorkspace(btn.dataset.openMemberWorkspace);}
});
$("platformWorkspaceList").addEventListener("click",e=>{
 const button=e.target.closest("[data-open-workspace]");
 if(button)openDeveloperWorkspace(button.dataset.openWorkspace);
});
$("backToDeveloperBtn").addEventListener("click",()=>showView("developerView"));
async function openDeveloperWorkspace(id){
 const selected=developerWorkspaces.find(x=>x.id===id);
 if(!selected)return;
 activeDeveloperWorkspaceId=id;
 msg("platformMessage","Загружаю склад…");
 try{
  const {data,error}=await db.rpc("platform_get_workspace_details",{p_workspace_id:id});
  if(error)throw error;
  if(!data)throw new Error("Сервер вернул пустой ответ");
  const members=data.members||[],products=data.inventory||[],historyRows=data.movements||[];
  $("devWorkspaceTitle").textContent=selected.name;
  $("devMembersCount").textContent=members.length;
  $("devProductsCount").textContent=products.length;
  $("devQuantityCount").textContent=products.reduce((sum,x)=>sum+Number(x.quantity||0),0);
  $("devTeamList").innerHTML=members.map(m=>{
   const label=m.role==="owner"?"Владелец":m.role==="manager"?"Менеджер":"Сотрудник";
   const who=m.user_id===currentUser.id?"Ты":m.user_id.slice(0,8)+"…";
   const remove=m.role==="owner"?"":'<button class="mini member-remove" data-dev-remove="'+m.user_id+'">Удалить</button>';
   return '<div class="team-row"><div><b>'+esc(who)+'</b><small>'+label+'</small></div>'+remove+'</div>';
  }).join("")||'<p class="muted">Участников пока нет.</p>';
  $("devInventoryBody").innerHTML=products.map(x=>'<tr><td data-label="Автомобиль"><strong>'+esc(x.make)+' '+esc(x.model)+'</strong><small>'+esc(x.year||"")+'</small></td><td data-label="Артикул">'+esc(x.part_number||"—")+'</td><td data-label="Тип">'+esc(x.glass_type||"—")+'</td><td data-label="Количество">'+x.quantity+'</td><td data-label="Закупка">'+money(x.purchase_price)+' сом</td><td data-label="Продажа">'+money(x.sale_price)+' сом</td><td data-label="Поставщик">'+esc(x.supplier||"—")+'</td><td data-label="Место">'+esc(x.location||"—")+'</td></tr>').join("")||'<tr><td colspan="8">В этом складе пока нет товаров.</td></tr>';
  $("devMovementList").innerHTML=historyRows.map(m=>{
   const label=m.movement_type==="in"?"Приход":m.movement_type==="out"?"Расход":"Коррекция";
   return '<div class="history-item"><div><b>'+esc(m.inventory?.make||"Товар")+' '+esc(m.inventory?.model||"")+'</b><small>'+new Date(m.created_at).toLocaleString("ru-RU")+' · '+esc(m.note||"Без комментария")+'</small></div><div class="history-type '+m.movement_type+'">'+label+': '+m.quantity+'</div></div>';
  }).join("")||'<p class="muted">Операций пока нет.</p>';
  window.history.pushState({glassstockNav:"page",page:"developerWorkspace"},"","#company-"+encodeURIComponent(id));
  showView("developerWorkspaceView");
  msg("platformMessage","Склад загружен.",true);
 }catch(error){
  msg("platformMessage","Не удалось открыть склад: "+(error.message||String(error)));
 }
}
$("devTeamList").addEventListener("click",async e=>{
 const btn=e.target.closest("[data-dev-remove]");
 if(!btn||!activeDeveloperWorkspaceId)return;
 const userId=btn.dataset.devRemove;
 if(!confirm("Удалить этого участника из склада?"))return;
 btn.disabled=true;
 const {error}=await db.rpc("remove_workspace_member",{p_workspace_id:activeDeveloperWorkspaceId,p_user_id:userId});
 if(error){btn.disabled=false;toast("Не удалось удалить: "+error.message);return;}
 toast("Участник удалён");
 await openDeveloperWorkspace(activeDeveloperWorkspaceId);
});

$("createWorkspaceBtn").addEventListener("click",async()=>{
 msg("setupMessage","Создаю склад…");
 const {error}=await db.rpc("create_glassstock_workspace",{p_name:$("workspaceName").value.trim()||"GlassStock"});
 if(error){msg("setupMessage",error.message);return;}await routeUser();
});
$("joinWorkspaceBtn").addEventListener("click",async()=>{
 msg("setupMessage","Подключаюсь…");
 const {error}=await db.rpc("join_glassstock_workspace",{p_join_code:$("joinCode").value.trim().toUpperCase()});
 if(error){msg("setupMessage",error.message);return;}await routeUser();
});

async function refresh(){
 if(!workspace)return;
 const [a,b,c]=await Promise.all([
  db.from("inventory").select("*").eq("workspace_id",workspace.id).order("make").order("model"),
  db.from("stock_movements").select("id,inventory_id,user_id,movement_type,quantity,note,created_at,unit_price,unit_cost,inventory(make,model)").eq("workspace_id",workspace.id).order("created_at",{ascending:false}).limit(500),
  membership?.role==="owner"?db.rpc("list_workspace_members"):{data:[],error:null}
 ]);
 if(a.error||b.error){toast("Ошибка загрузки: "+(a.error||b.error).message);return;}
 items=a.data||[];movements=b.data||[];teamMembers=c.data||[];render();
 const linkedItem=new URLSearchParams(location.search).get("item");
 if(linkedItem){const found=items.find(x=>x.id===linkedItem);if(found){$("search").value=[found.make,found.model,found.part_number||""].join(" ");render();toast("Найдено стекло: "+found.make+" "+found.model);}}
}
function renderTeam(){
 if(membership?.role!=="owner")return;
 $("teamList").innerHTML=teamMembers.map(m=>{
  const who=m.user_id===currentUser.id?"Ты":esc(m.user_id.slice(0,8)+"…");
  if(m.role==="owner")return '<div class="team-row"><div><b>'+who+'</b><small>Владелец</small></div></div>';
  return '<div class="team-row"><div><b>'+who+'</b><small>'+new Date(m.created_at).toLocaleDateString("ru-RU")+'</small></div><div class="team-controls"><select data-role-user="'+m.user_id+'"><option value="staff" '+(m.role==="staff"?"selected":"")+'>Сотрудник</option><option value="manager" '+(m.role==="manager"?"selected":"")+'>Менеджер</option></select><button class="mini" data-save-role="'+m.user_id+'">Сохранить</button><button class="mini member-remove" data-owner-remove="'+m.user_id+'">Удалить</button></div></div>';
 }).join("")||'<p class="muted">Пока только владелец.</p>';
}
function render(){
 const total=items.reduce((n,x)=>n+x.quantity,0),low=items.filter(x=>x.quantity<=x.min_quantity).length;
 const purchaseValue=items.reduce((n,x)=>n+x.quantity*Number(x.purchase_price||0),0);
 const saleValue=items.reduce((n,x)=>n+x.quantity*Number(x.sale_price||0),0);
 const cutoff=Date.now()-30*24*60*60*1000;
 const recentSales=movements.filter(m=>m.movement_type==="out"&&m.unit_price!==null&&m.unit_cost!==null&&new Date(m.created_at).getTime()>=cutoff);
 const revenue=recentSales.reduce((n,m)=>n+Number(m.unit_price||0)*m.quantity,0);
 const profit=recentSales.reduce((n,m)=>n+(Number(m.unit_price||0)-Number(m.unit_cost||0))*m.quantity,0);
 $("statItems").textContent=items.length;$("statQty").textContent=total;$("statLow").textContent=low;
 $("statPurchaseValue").textContent=money(purchaseValue);$("statSaleValue").textContent=money(saleValue);
 $("reportRevenue").textContent=money(revenue)+" сом";$("reportProfit").textContent=money(profit)+" сом";
  const q=normalizeSearchText($("search").value),filter=$("filter").value;
  const filtered=items.filter(x=>{
   const t=normalizeSearchText([x.make,x.model,x.part_number,x.glass_type,x.location,x.year,x.supplier].join(" "));
   return (!q||t.includes(q))&&(filter==="all"||(filter==="low"&&x.quantity<=x.min_quantity)||(filter==="empty"&&x.quantity===0));
  });
 $("inventoryBody").innerHTML=filtered.map(x=>{
  const actions='<button class="mini action-qr" data-qr="'+x.id+'" aria-label="QR-этикетка" title="Создать QR-этикетку">QR</button><button class="mini action-move" data-move="'+x.id+'" aria-label="Приход или расход" title="Приход / расход"><span aria-hidden="true">＋</span><b>Движение</b></button>'+
   (membership.role!=="staff"?'<button class="mini action-edit" data-edit="'+x.id+'" aria-label="Изменить позицию" title="Изменить позицию"><span aria-hidden="true">✎</span><b>Изменить</b></button><button class="mini action-delete" data-delete="'+x.id+'" aria-label="Удалить позицию" title="Удалить позицию"><span aria-hidden="true">×</span></button>':"");
  return '<tr><td data-label="Автомобиль"><strong>'+esc(x.make)+' '+esc(x.model)+'</strong><small>'+esc(x.year||"")+'</small></td>'+
   '<td data-label="Артикул">'+esc(x.part_number||"—")+'</td><td data-label="Тип стекла">'+esc(x.glass_type||"—")+'</td>'+
   '<td data-label="Остаток" class="qty '+(x.quantity<=x.min_quantity?"low":"good")+'">'+x.quantity+' <small>/ мин. '+x.min_quantity+'</small></td>'+
   '<td data-label="Закупка">'+money(x.purchase_price)+' сом</td><td data-label="Продажа">'+money(x.sale_price)+' сом</td><td data-label="Прибыль / шт." class="'+(Number(x.sale_price||0)-Number(x.purchase_price||0)>=0?"good":"low")+'">'+money(Number(x.sale_price||0)-Number(x.purchase_price||0))+' сом</td><td data-label="Поставщик">'+esc(x.supplier||"—")+'</td><td data-label="Место">'+esc(x.location||"—")+'</td><td data-label="Действия"><div class="row-actions">'+actions+'</div></td></tr>';
 }).join("");
 $("emptyState").classList.toggle("hidden",filtered.length>0);
 renderTeam();
 $("historyList").innerHTML=movements.slice(0,25).map(m=>{
  const label=m.movement_type==="in"?"Приход":m.movement_type==="out"?"Расход":"Коррекция";
  const price=m.unit_price==null?"":" · "+money(m.unit_price)+" сом/шт.";
  return '<div class="history-item"><div><b>'+esc(m.inventory?.make||"Товар")+' '+esc(m.inventory?.model||"")+'</b><small>'+new Date(m.created_at).toLocaleString("ru-RU")+' · '+esc(m.note||"Без комментария")+price+'</small></div><div class="history-type '+m.movement_type+'">'+label+': '+m.quantity+'</div></div>';
 }).join("")||'<p class="muted">Операций пока нет.</p>';
}
$("search").addEventListener("input",render);$("filter").addEventListener("change",render);
$("addBtn").addEventListener("click",()=>openItem());
function openItem(item=null){
 $("itemForm").reset();$("itemId").value=item?.id||"";$("itemDialogTitle").textContent=item?"Изменить позицию":"Новая позиция";
 $("make").value=item?.make||"";$("model").value=item?.model||"";$("year").value=item?.year||"";$("partNumber").value=item?.part_number||"";
 $("glassType").value=item?.glass_type||"";$("location").value=item?.location||"";$("quantity").value=item?.quantity??0;$("quantity").disabled=!!item;$("minQuantity").value=item?.min_quantity??0;
 $("purchasePrice").value=item?.purchase_price??0;$("salePrice").value=item?.sale_price??0;$("supplier").value=item?.supplier||"";$("notes").value=item?.notes||"";
 msg("itemMessage","");openDialog("itemDialog");
}
$("inventoryBody").addEventListener("click",async e=>{
 const edit=e.target.closest("[data-edit]"),move=e.target.closest("[data-move]"),del=e.target.closest("[data-delete]"),qr=e.target.closest("[data-qr]");
 if(qr){openQrLabel(items.find(x=>x.id===qr.dataset.qr));}
 if(edit){openItem(items.find(x=>x.id===edit.dataset.edit));}
 if(move){const x=items.find(x=>x.id===move.dataset.move);$("movementForm").reset();$("movementItemId").value=x.id;$("movementItemName").textContent=x.make+" "+x.model+" · остаток "+x.quantity;setMovementPrice(x);openDialog("movementDialog");}
 if(del){const x=items.find(x=>x.id===del.dataset.delete);if(!confirm("Удалить "+x.make+" "+x.model+"?"))return;const {error}=await db.from("inventory").delete().eq("id",x.id);if(error)toast(error.message);else{toast("Позиция удалена");await refresh();}}
});
$("itemForm").addEventListener("submit",async e=>{
 e.preventDefault();const id=$("itemId").value;
 const requestedQuantity=Number($("quantity").value);
 const row={workspace_id:workspace.id,make:$("make").value.trim(),model:$("model").value.trim(),year:$("year").value.trim()||null,part_number:$("partNumber").value.trim()||null,glass_type:$("glassType").value.trim()||null,location:$("location").value.trim()||null,quantity:id?requestedQuantity:0,min_quantity:Number($("minQuantity").value),purchase_price:Number($("purchasePrice").value||0),sale_price:Number($("salePrice").value||0),supplier:$("supplier").value.trim()||null,notes:$("notes").value.trim()||null};
 const result=id?await db.from("inventory").update(row).eq("id",id):await db.from("inventory").insert(row).select("id").single();
 if(result.error){msg("itemMessage",result.error.message);return;}
 if(!id&&requestedQuantity>0){
  const {error:movementError}=await db.rpc("record_stock_movement",{p_inventory_id:result.data.id,p_movement_type:"in",p_quantity:requestedQuantity,p_note:"Начальное пополнение при создании позиции",p_unit_price:Number($("purchasePrice").value||0)});
  if(movementError){msg("itemMessage","Позиция создана, но начальное пополнение не записалось: "+movementError.message);await refresh();return;}
 }
 $("itemDialog").close();toast("Сохранено");await refresh();
});
function openQrLabel(item){
 if(!item)return;
 $("qrLabelName").textContent=(item.make+" "+item.model).trim();
 $("qrLabelDetails").textContent=["Артикул: "+(item.part_number||"—"),"Тип: "+(item.glass_type||"—"),"Место: "+(item.location||"—"),"Остаток: "+item.quantity+" шт."].join(" · ");
 $("qrLabelCompany").textContent=workspace?.name||"GlassStock";
 $("qrCode").innerHTML="";
 const url=new URL(location.href);url.search="";url.hash="";url.searchParams.set("item",item.id);
 if(typeof QRCode==="undefined"){$("qrMessage").textContent="QR-библиотека не загрузилась. Проверь интернет и обнови страницу.";}
 else{new QRCode($("qrCode"),{text:url.toString(),width:180,height:180,correctLevel:QRCode.CorrectLevel.M});$("qrMessage").textContent="Отсканируй код камерой, чтобы открыть эту позицию в GlassStock." ;}
 openDialog("qrDialog");
}
$("inventoryBody").addEventListener("click",e=>{const btn=e.target.closest("[data-qr]");if(btn)openQrLabel(items.find(x=>x.id===btn.dataset.qr));});
$("printQrBtn").addEventListener("click",()=>window.print());
function setMovementPrice(item){
 const type=$("movementType").value;
 $("movementPrice").value=type==="in"?(item?.purchase_price??0):type==="out"?(item?.sale_price??0):"";
 $("movementPrice").disabled=type==="adjust";
}
$("movementType").addEventListener("change",()=>setMovementPrice(items.find(x=>x.id===$("movementItemId").value)));
$("movementForm").addEventListener("submit",async e=>{
 e.preventDefault();const rawPrice=$("movementPrice").value;
 const {error}=await db.rpc("record_stock_movement",{p_inventory_id:$("movementItemId").value,p_movement_type:$("movementType").value,p_quantity:Number($("movementQty").value),p_note:$("movementNote").value.trim()||null,p_unit_price:rawPrice===""?null:Number(rawPrice)});
 if(error){msg("movementMessage",error.message);return;}
 $("movementDialog").close();toast("Операция записана");await refresh();
});
$("teamBtn").addEventListener("click",async()=>{await refresh();openDialog("teamDialog");});
$("teamList").addEventListener("click",async e=>{
 const remove=e.target.closest("[data-owner-remove]");
 if(remove){
  const userId=remove.dataset.ownerRemove;
  if(!confirm("Удалить участника из команды?"))return;
  remove.disabled=true;
  const {error}=await db.rpc("remove_workspace_member",{p_workspace_id:workspace.id,p_user_id:userId});
  if(error){remove.disabled=false;toast("Не удалось удалить: "+error.message);return;}
  toast("Участник удалён");await refresh();return;
 }
 const btn=e.target.closest("[data-save-role]");if(!btn)return;
 const userId=btn.dataset.saveRole,select=$("teamList").querySelector('[data-role-user="'+userId+'"]');
 btn.disabled=true;const {error}=await db.rpc("set_workspace_member_role",{p_user_id:userId,p_role:select.value});btn.disabled=false;
 if(error){toast(error.message);return;}toast("Роль сотрудника обновлена");await refresh();
});
$("inviteBtn").addEventListener("click",()=>{$("inviteCodeDisplay").textContent=workspace.join_code;openDialog("inviteDialog");});
$("copyInviteBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(workspace.join_code);toast("Код скопирован");}catch{toast("Код: "+workspace.join_code);}});
$("exportBtn").addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),workspace:workspace.name,items,movements},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="glassstock-backup.json";a.click();URL.revokeObjectURL(url);
});
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
init();
