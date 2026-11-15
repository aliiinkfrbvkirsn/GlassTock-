/* GlassStock v2.0 — pricing, stock movements, reports and team roles */
const SUPABASE_URL = "https://octkotsbkhvcuxwkzopg.supabase.co";
const SUPABASE_KEY = "sb_publishable_gut8UJBnqJIOxDnBOwzAVg_80T6m7u-";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
let tab="login",currentUser=null,workspace=null,membership=null,items=[],movements=[],teamMembers=[];
const views=["authView","setupView","appView"];
function showView(id){views.forEach(v=>$(v).classList.toggle("hidden",v!==id));$("logoutBtn").classList.toggle("hidden",id==="authView");}
function msg(id,text,ok=false){const el=$(id);el.textContent=text;el.classList.toggle("success",ok);}
function toast(text){const el=$("toast");el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function setConnection(text,kind=""){const el=$("connection");el.textContent="● "+text;el.className="status "+kind;}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
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
 const result=tab==="signup"?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
 $("authSubmit").disabled=false;
 if(result.error){msg("authMessage",result.error.message);return;}
 if(tab==="signup"&&!result.data.session){msg("authMessage","Аккаунт создан. Проверь почту и подтверди адрес, затем войди.",true);return;}
 currentUser=result.data.user;await routeUser();
});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();});

async function routeUser(){
 setConnection("Загрузка…");
 const {data:member,error}=await db.from("workspace_members").select("workspace_id,role").eq("user_id",currentUser.id).maybeSingle();
 if(error){setConnection("Ошибка доступа","bad");showView("setupView");msg("setupMessage","Не удалось проверить участие: "+error.message);return;}
 if(!member){showView("setupView");setConnection("Нужна настройка");return;}
 membership=member;
 const {data:ws,error:wsErr}=await db.from("workspaces").select("id,name,join_code").eq("id",member.workspace_id).single();
 if(wsErr){showView("setupView");msg("setupMessage",wsErr.message);return;}
 workspace=ws;$("workspaceTitle").textContent=ws.name;
 $("userLabel").textContent=currentUser.email+" · "+({owner:"Владелец",manager:"Менеджер",staff:"Сотрудник"}[member.role]||"Сотрудник");
 $("teamBtn").classList.toggle("hidden",member.role!=="owner");
 $("inviteBtn").classList.toggle("hidden",member.role!=="owner");
 $("addBtn").classList.toggle("hidden",member.role==="staff");
 showView("appView");setConnection("Облако подключено","ok");await refresh();
}
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
}
function renderTeam(){
 if(membership?.role!=="owner")return;
 $("teamList").innerHTML=teamMembers.map(m=>{
  const who=m.user_id===currentUser.id?"Ты":esc(m.user_id.slice(0,8)+"…");
  if(m.role==="owner")return '<div class="team-row"><div><b>'+who+'</b><small>Владелец</small></div></div>';
  return '<div class="team-row"><div><b>'+who+'</b><small>'+new Date(m.created_at).toLocaleDateString("ru-RU")+'</small></div><div class="team-controls"><select data-role-user="'+m.user_id+'"><option value="staff" '+(m.role==="staff"?"selected":"")+'>Сотрудник</option><option value="manager" '+(m.role==="manager"?"selected":"")+'>Менеджер</option></select><button class="mini" data-save-role="'+m.user_id+'">Сохранить</button></div></div>';
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
 const q=$("search").value.trim().toLowerCase(),filter=$("filter").value;
 const filtered=items.filter(x=>{
  const t=[x.make,x.model,x.part_number,x.glass_type,x.location,x.year,x.supplier].join(" ").toLowerCase();
  return (!q||t.includes(q))&&(filter==="all"||(filter==="low"&&x.quantity<=x.min_quantity)||(filter==="empty"&&x.quantity===0));
 });
 $("inventoryBody").innerHTML=filtered.map(x=>{
  const actions='<button class="mini action-move" data-move="'+x.id+'" aria-label="Приход или расход" title="Приход / расход"><span aria-hidden="true">＋</span><b>Движение</b></button>'+
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
 $("glassType").value=item?.glass_type||"";$("location").value=item?.location||"";$("quantity").value=item?.quantity??0;$("minQuantity").value=item?.min_quantity??0;
 $("purchasePrice").value=item?.purchase_price??0;$("salePrice").value=item?.sale_price??0;$("supplier").value=item?.supplier||"";$("notes").value=item?.notes||"";
 msg("itemMessage","");$("itemDialog").showModal();
}
$("inventoryBody").addEventListener("click",async e=>{
 const edit=e.target.closest("[data-edit]"),move=e.target.closest("[data-move]"),del=e.target.closest("[data-delete]");
 if(edit){openItem(items.find(x=>x.id===edit.dataset.edit));}
 if(move){const x=items.find(x=>x.id===move.dataset.move);$("movementForm").reset();$("movementItemId").value=x.id;$("movementItemName").textContent=x.make+" "+x.model+" · остаток "+x.quantity;setMovementPrice(x);$("movementDialog").showModal();}
 if(del){const x=items.find(x=>x.id===del.dataset.delete);if(!confirm("Удалить "+x.make+" "+x.model+"?"))return;const {error}=await db.from("inventory").delete().eq("id",x.id);if(error)toast(error.message);else{toast("Позиция удалена");await refresh();}}
});
$("itemForm").addEventListener("submit",async e=>{
 e.preventDefault();const id=$("itemId").value;
 const row={workspace_id:workspace.id,make:$("make").value.trim(),model:$("model").value.trim(),year:$("year").value.trim()||null,part_number:$("partNumber").value.trim()||null,glass_type:$("glassType").value.trim()||null,location:$("location").value.trim()||null,quantity:Number($("quantity").value),min_quantity:Number($("minQuantity").value),purchase_price:Number($("purchasePrice").value||0),sale_price:Number($("salePrice").value||0),supplier:$("supplier").value.trim()||null,notes:$("notes").value.trim()||null};
 const result=id?await db.from("inventory").update(row).eq("id",id):await db.from("inventory").insert(row);
 if(result.error){msg("itemMessage",result.error.message);return;}
 $("itemDialog").close();toast("Сохранено");await refresh();
});
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
$("teamBtn").addEventListener("click",async()=>{await refresh();$("teamDialog").showModal();});
$("teamList").addEventListener("click",async e=>{
 const btn=e.target.closest("[data-save-role]");if(!btn)return;
 const userId=btn.dataset.saveRole,select=$("teamList").querySelector('[data-role-user="'+userId+'"]');
 btn.disabled=true;const {error}=await db.rpc("set_workspace_member_role",{p_user_id:userId,p_role:select.value});btn.disabled=false;
 if(error){toast(error.message);return;}toast("Роль сотрудника обновлена");await refresh();
});
$("inviteBtn").addEventListener("click",()=>{$("inviteCodeDisplay").textContent=workspace.join_code;$("inviteDialog").showModal();});
$("copyInviteBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(workspace.join_code);toast("Код скопирован");}catch{toast("Код: "+workspace.join_code);}});
$("exportBtn").addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),workspace:workspace.name,items,movements},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="glassstock-backup.json";a.click();URL.revokeObjectURL(url);
});
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
init();
