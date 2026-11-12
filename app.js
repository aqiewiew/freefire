(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT")
    && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  let db, currentUser, transactions = [], tournaments = [], matches = [], pinHash = null;
  const money = (n) => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n || 0));
  const today = () => new Date().toISOString().slice(0,10);
  const safe = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = (msg) => { $("toast").textContent = msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"), 2800); };
  const resultText = (v) => ({pending:"Belum selesai",win:"Menang",lose:"Kalah",draw:"Seri"}[v] || v);
  const dateText = (v) => v ? new Date(v+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-";
  const showAuth = (yes) => { $("auth-view").classList.toggle("hidden", !yes); $("app-view").classList.toggle("hidden", yes); };
  const err = (e) => { console.error(e); toast(e?.message || "Terjadi kesalahan."); };

  async function init() {
    $("tx-date").value = $("tour-date").value = $("match-date").value = today();
    if (!configured || !window.supabase) {
      showAuth(true);
      toast("Atur URL dan anon key Supabase di assets/js/config.js terlebih dahulu.");
      $("auth-form").addEventListener("submit", e => { e.preventDefault(); toast("Konfigurasi Supabase belum diisi."); });
      $("signup-btn").addEventListener("click", () => toast("Isi konfigurasi Supabase terlebih dahulu."));
      return;
    }
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const {data:{session}} = await db.auth.getSession();
    if (session) await enterApp(session.user); else showAuth(true);
    db.auth.onAuthStateChange(async (_event, session) => {
      if (session && !currentUser) await enterApp(session.user);
      if (!session) { currentUser = null; showAuth(true); }
    });
    $("auth-form").addEventListener("submit", login);
    $("signup-btn").addEventListener("click", signup);
    $("logout-btn").addEventListener("click", logout);
    $("mobile-logout").addEventListener("click", logout);
    document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
    $("transaction-form").addEventListener("submit", saveTransaction);
    $("tournament-form").addEventListener("submit", saveTournament);
    $("match-form").addEventListener("submit", saveMatch);
    $("tx-search").addEventListener("input", renderTransactions);
    $("export-json").addEventListener("click", exportBackup);
    $("pin-form").addEventListener("submit", savePin);
  }

  async function login(e) {
    e.preventDefault();
    const {error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if (error) return err(error);
    toast("Berhasil masuk.");
  }
  async function signup() {
    const email = $("email").value.trim(), password = $("password").value;
    if (!email || password.length < 8) return toast("Isi email dan password minimal 8 karakter.");
    const {error} = await db.auth.signUp({email,password});
    if (error) return err(error);
    toast("Pendaftaran diproses. Periksa email jika verifikasi diaktifkan.");
  }
  async function logout() {
    const {error} = await db.auth.signOut();
    if (error) err(error); else { currentUser=null; showAuth(true); toast("Kamu sudah keluar."); }
  }
  async function enterApp(user) {
    currentUser = user; $("user-email").textContent = user.email || "";
    showAuth(false);
    await loadAll();
    await checkPin();
  }
  async function loadAll() {
    const [tx,tour,match] = await Promise.all([
      db.from("transactions").select("*").order("transaction_date",{ascending:false}).order("created_at",{ascending:false}),
      db.from("tournaments").select("*").order("event_date",{ascending:false}),
      db.from("match_notes").select("*").order("match_date",{ascending:false})
    ]);
    if (tx.error) throw tx.error; if (tour.error) throw tour.error; if (match.error) throw match.error;
    transactions=tx.data||[]; tournaments=tour.data||[]; matches=match.data||[];
    renderAll();
  }
  function navigate(page) {
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    $("page-"+page).classList.remove("hidden");
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    const names={dashboard:"Dashboard",transactions:"Transaksi",tournaments:"Tournament / FT",matches:"Catatan Laga",reports:"Laporan",settings:"Pengaturan"};
    $("page-title").textContent=names[page]||"Dashboard";
    $("page-eyebrow").textContent=page.toUpperCase();
  }
  function renderAll() { renderDashboard(); renderTransactions(); renderTournaments(); renderMatches(); renderReports(); $("sync-time").textContent="Terakhir dimuat: "+new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}); }
  function totals(list=transactions) {
    const income=list.filter(x=>x.type==="income").reduce((a,x)=>a+Number(x.amount),0);
    const expense=list.filter(x=>x.type==="expense").reduce((a,x)=>a+Number(x.amount),0);
    return {income,expense,net:income-expense};
  }
  function renderDashboard() {
    const t=totals(); $("total-balance").textContent=money(t.net); $("total-income").textContent=money(t.income); $("total-expense").textContent=money(t.expense); $("total-count").textContent=transactions.length;
    $("recent-list").innerHTML=tableRows(transactions.slice(0,6));
  }
  function tableRows(list) {
    if (!list.length) return '<div class="empty">Belum ada catatan.</div>';
    return `<table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Nominal</th></tr></thead><tbody>${list.map(x=>`<tr><td>${dateText(x.transaction_date)}</td><td>${safe(x.note||"-")}</td><td>${safe(x.category||"-")}</td><td class="${x.type==="income"?"positive":"negative"}">${x.type==="income"?"+":"−"} ${money(x.amount)} ${x.receipt_path?'<span title="Ada bukti"> · 📎</span>':""}</td></tr>`).join("")}</tbody></table>`;
  }
  function renderTransactions() {
    const q=($("tx-search").value||"").toLowerCase();
    const filtered=transactions.filter(x=>(x.note||"").toLowerCase().includes(q)||(x.category||"").toLowerCase().includes(q));
    $("transaction-list").innerHTML=tableRows(filtered);
  }
  async function uploadReceipt(file) {
    if (!file) return null;
    if (!file.type.startsWith("image/")) throw new Error("File bukti harus berupa gambar.");
    if (file.size > 5*1024*1024) throw new Error("Ukuran gambar maksimal 5 MB.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await db.storage.from("receipts").upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    return path;
  }
  async function saveTransaction(e) {
    e.preventDefault();
    try {
      const file=$("tx-receipt").files[0], receipt_path=await uploadReceipt(file);
      const payload={user_id:currentUser.id,type:$("tx-type").value,amount:Number($("tx-amount").value),category:$("tx-category").value,transaction_date:$("tx-date").value,note:$("tx-note").value.trim(),receipt_path};
      if(!Number.isFinite(payload.amount)||payload.amount<=0) return toast("Nominal harus lebih dari nol.");
      const {error}=await db.from("transactions").insert(payload); if(error) throw error;
      $("transaction-form").reset(); $("tx-date").value=today(); await loadAll(); toast("Transaksi berhasil disimpan.");
    } catch(e){err(e);}
  }
  async function saveTournament(e) {
    e.preventDefault();
    try {
      const payload={user_id:currentUser.id,name:$("tour-name").value.trim(),event_date:$("tour-date").value,entry_fee:Number($("tour-fee").value||0),prize_received:Number($("tour-prize").value||0),result:$("tour-result").value,note:$("tour-note").value.trim()};
      if(payload.entry_fee<0||payload.prize_received<0) return toast("Nominal tidak boleh negatif.");
      const {error}=await db.from("tournaments").insert(payload); if(error) throw error;
      const entries=[];
      if(payload.entry_fee>0) entries.push({user_id:currentUser.id,type:"expense",amount:payload.entry_fee,category:"Biaya turnamen",transaction_date:payload.event_date,note:`Biaya turnamen: ${payload.name}`});
      if(payload.prize_received>0) entries.push({user_id:currentUser.id,type:"income",amount:payload.prize_received,category:"Hadiah turnamen diterima",transaction_date:payload.event_date,note:`Hadiah diterima: ${payload.name}`});
      if(entries.length){const r=await db.from("transactions").insert(entries);if(r.error) throw r.error;}
      $("tournament-form").reset(); $("tour-date").value=today(); $("tour-fee").value="0"; $("tour-prize").value="0"; await loadAll(); toast("Catatan turnamen disimpan.");
    } catch(e){err(e);}
  }
  async function saveMatch(e) {
    e.preventDefault();
    try {
      const expense=Number($("match-expense").value||0);
      const payload={user_id:currentUser.id,player_name:$("match-player").value.trim(),opponent_note:$("match-opponent").value.trim(),match_date:$("match-date").value,result:$("match-result").value,actual_expense:expense,note:$("match-note").value.trim()};
      const {error}=await db.from("match_notes").insert(payload); if(error) throw error;
      if(expense>0 && $("match-add-expense").checked){
        const r=await db.from("transactions").insert({user_id:currentUser.id,type:"expense",amount:expense,category:"Dukungan teman",transaction_date:payload.match_date,note:`Catatan laga: ${payload.player_name}`});
        if(r.error) throw r.error;
      }
      $("match-form").reset(); $("match-date").value=today(); $("match-expense").value="0"; $("match-add-expense").checked=true; await loadAll(); toast("Catatan laga disimpan.");
    } catch(e){err(e);}
  }
  function renderTournaments() {
    $("tournament-list").innerHTML=tournaments.length?`<table><thead><tr><th>Tanggal</th><th>Turnamen</th><th>Hasil</th><th>Biaya</th><th>Hadiah aktual</th></tr></thead><tbody>${tournaments.map(x=>`<tr><td>${dateText(x.event_date)}</td><td>${safe(x.name)}</td><td>${resultText(x.result)}</td><td>${money(x.entry_fee)}</td><td class="positive">${money(x.prize_received)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Belum ada turnamen.</div>';
  }
  function renderMatches() {
    $("match-list").innerHTML=matches.length?`<table><thead><tr><th>Tanggal</th><th>Pemain</th><th>Lawan</th><th>Hasil</th><th>Pengeluaran aktual</th></tr></thead><tbody>${matches.map(x=>`<tr><td>${dateText(x.match_date)}</td><td>${safe(x.player_name)}</td><td>${safe(x.opponent_note||"-")}</td><td>${resultText(x.result)}</td><td>${money(x.actual_expense)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Belum ada catatan laga.</div>';
  }
  function renderReports() {
    const month=today().slice(0,7), list=transactions.filter(x=>(x.transaction_date||"").startsWith(month)), t=totals(list);
    $("month-income").textContent=money(t.income); $("month-expense").textContent=money(t.expense); $("month-net").textContent=money(t.net);
  }
  function exportBackup() {
    const data={exported_at:new Date().toISOString(),transactions,tournaments,matches};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ff-money-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
  }
  async function digestPin(pin,salt) {
    const enc=new TextEncoder(), key=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveBits"]);
    const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:180000,hash:"SHA-256"},key,256);
    return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  async function checkPin() {
    const {data,error}=await db.from("app_profiles").select("pin_salt,pin_hash").eq("user_id",currentUser.id).maybeSingle();
    if(error) return err(error);
    if(!data?.pin_hash) { toast("Akun aktif. Atur PIN aplikasi di menu Pengaturan."); return; }
    const entered=prompt("Masukkan PIN aplikasi 8 digit:");
    if(entered===null) { await logout(); return; }
    if(!/^\d{8}$/.test(entered) || await digestPin(entered,data.pin_salt)!==data.pin_hash) {
      toast("PIN tidak sesuai. Silakan masuk ulang menggunakan akun."); await logout();
    }
  }
  async function savePin(e) {
    e.preventDefault();
    const pin=$("pin-new").value, confirm=$("pin-confirm").value;
    if(!/^\d{8}$/.test(pin)) return toast("PIN harus tepat 8 angka.");
    if(pin!==confirm) return toast("Konfirmasi PIN tidak sama.");
    try {
      const salt=crypto.randomUUID(), hash=await digestPin(pin,salt);
      const {error}=await db.from("app_profiles").upsert({user_id:currentUser.id,pin_salt:salt,pin_hash:hash,updated_at:new Date().toISOString()});
      if(error) throw error;
      $("pin-form").reset(); toast("PIN aplikasi berhasil diperbarui.");
    } catch(e){err(e);}
  }
  init().catch(err);
})();