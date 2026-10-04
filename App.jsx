import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, CheckCircle2, Coins, Compass, DollarSign, Heart, Home, LogIn,
  MessageCircle, MoreHorizontal, Play, Plus, Search, Settings, ShieldCheck,
  User, Users, Video, Wallet, Radio, LogOut, Menu, X, Send
} from "lucide-react";
import { supabase, getProfile, publicMediaUrl } from "./lib";

const APP_NAME = "Owino Live Chat";

function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({data}) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        try { setProfile(await getProfile(data.session.user.id)); } catch {}
      }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        try { setProfile(await getProfile(session.user.id)); } catch {}
      } else setProfile(null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  return {user, profile, loading};
}

function Shell({children, profile}) {
  const nav = [
    ["/", "Home", Home], ["/discover", "Discover", Compass],
    ["/live", "LIVE", Radio], ["/upload", "Create", Plus],
    ["/wallet", "Wallet", Wallet], ["/profile", "Profile", User]
  ];
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-dot"></span>{APP_NAME}</Link>
      <div className="top-actions">
        <Link to="/search" className="icon-btn"><Search size={20}/></Link>
        <Link to="/notifications" className="icon-btn"><Bell size={20}/></Link>
        <Link to="/profile" className="avatar">{(profile?.display_name || "U")[0].toUpperCase()}</Link>
      </div>
    </header>
    <main className="content">{children}</main>
    <nav className="bottom-nav">{nav.map(([to,label,Icon]) =>
      <Link key={to} to={to} className={location.pathname===to ? "active" : ""}><Icon size={21}/><span>{label}</span></Link>
    )}</nav>
  </div>
}

function Auth({mode="login"}) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [name,setName]=useState(""); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
  const nav=useNavigate();
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      if(mode==="signup") {
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}});
        if(error) throw error;
        if(data.user) {
          await supabase.from("profiles").upsert({id:data.user.id,display_name:name||email.split("@")[0]});
        }
        setMsg("Account created. Check your email if confirmation is enabled.");
      } else {
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error) throw error;
        nav("/");
      }
    } catch(e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-card">
    <div className="logo-large">O</div><h1>{mode==="login"?"Welcome back":"Create your account"}</h1>
    <p className="muted">{mode==="login"?"Sign in to Owino Live Chat":"Join creators, viewers and live communities."}</p>
    <form onSubmit={submit} className="stack">
      {mode==="signup" && <input placeholder="Display name" value={name} onChange={e=>setName(e.target.value)} required/>}
      <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" required/>
      <button className="primary" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
    </form>
    {msg && <div className="notice">{msg}</div>}
    <p className="muted">{mode==="login"?<>New here? <Link to="/signup">Create an account</Link></>:<>Already registered? <Link to="/login">Sign in</Link></>}</p>
  </div></div>
}

function Feed() {
  const [videos,setVideos]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{supabase.from("videos").select("*,profiles(display_name,username,avatar_url,verified)").eq("status","published").order("created_at",{ascending:false}).limit(30)
    .then(({data})=>{setVideos(data||[]);setLoading(false)})},[]);
  return <div className="feed">
    <section className="hero"><div><span className="pill">CREATE • CONNECT • EARN</span><h1>Your community.<br/>Your stage.</h1><p>Discover creators, watch short videos and join live conversations on Owino Live Chat.</p><div className="row"><Link className="primary" to="/upload"><Plus size={18}/> Create</Link><Link className="secondary" to="/live"><Radio size={18}/> Go LIVE</Link></div></div><div className="hero-art"><Video size={80}/></div></section>
    <div className="section-head"><h2>For You</h2><Link to="/discover">See more</Link></div>
    {loading ? <div className="empty">Loading videos…</div> : videos.length===0 ? <Empty title="Your feed is ready" text="Upload the first video and start building your community."/> :
      <div className="video-grid">{videos.map(v=><VideoCard key={v.id} v={v}/>)}</div>}
  </div>
}

function VideoCard({v}) {
  const url=publicMediaUrl(v.storage_path);
  return <article className="video-card">
    <div className="video-box">{url ? <video src={url} controls playsInline preload="metadata"/> : <div className="video-placeholder"><Play size={42}/></div>}</div>
    <div className="video-meta"><div className="creator-line"><div className="avatar small">{(v.profiles?.display_name||"C")[0]}</div><b>{v.profiles?.display_name||"Creator"}</b>{v.profiles?.verified&&<CheckCircle2 size={15} className="verified"/>}</div><h3>{v.title||"Untitled video"}</h3><div className="muted">{v.description||" "}</div></div>
  </article>
}

function Empty({title,text}) { return <div className="empty"><div className="empty-icon"><Play/></div><h3>{title}</h3><p>{text}</p></div> }

function Upload({user}) {
  const [file,setFile]=useState(null),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  async function submit(e){
    e.preventDefault(); if(!file||!user)return; setBusy(true);setMsg("");
    try{
      const ext=file.name.split(".").pop(); const path=`videos/${user.id}/${crypto.randomUUID()}.${ext}`;
      const {error:up}=await supabase.storage.from("media").upload(path,file,{contentType:file.type});
      if(up)throw up;
      const {error}=await supabase.from("videos").insert({creator_id:user.id,title,description,storage_path:path,status:"published"});
      if(error)throw error; setMsg("Video published successfully.");setFile(null);setTitle("");setDescription("");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <div className="page"><PageTitle icon={Plus} title="Create a video" subtitle="Upload a short video for your community."/>
    <form className="panel stack" onSubmit={submit}>
      <label className="dropzone"><input type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0]||null)} required/><Video size={32}/><b>{file?file.name:"Choose a video"}</b><span className="muted">MP4/WebM recommended</span></label>
      <input placeholder="Video title" value={title} onChange={e=>setTitle(e.target.value)} maxLength="120" required/>
      <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} rows="4" maxLength="1000"/>
      <button className="primary" disabled={busy}>{busy?"Uploading…":"Publish video"}</button>
      {msg&&<div className="notice">{msg}</div>}
    </form>
  </div>
}

function Profile({user,profile}) {
  const [editing,setEditing]=useState(false),[name,setName]=useState(profile?.display_name||""),[bio,setBio]=useState(profile?.bio||""),[saving,setSaving]=useState(false);
  async function save(){setSaving(true);await supabase.from("profiles").update({display_name:name,bio}).eq("id",user.id);setSaving(false);setEditing(false)}
  return <div className="page"><div className="profile-header"><div className="profile-avatar">{(profile?.display_name||"U")[0]}</div><div className="grow"><h1>{profile?.display_name||"Your Profile"} {profile?.verified&&<CheckCircle2 className="verified"/>}</h1><p className="muted">@{profile?.username||"creator"}</p><p>{profile?.bio||"Tell your community about yourself."}</p></div><button className="secondary" onClick={()=>setEditing(!editing)}><Settings size={17}/> Edit</button></div>
    {editing&&<div className="panel stack"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Display name"/><textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Bio"/><button className="primary" onClick={save}>{saving?"Saving…":"Save profile"}</button></div>}
    <div className="stats"><Stat label="Followers" value="0"/><Stat label="Following" value="0"/><Stat label="Likes" value="0"/><Stat label="Earnings" value="KES 0"/></div>
    <div className="section-head"><h2>Your creator tools</h2></div><div className="feature-grid">
      <Feature icon={Radio} title="Go LIVE" text="Start a live room and interact with viewers." to="/live"/>
      <Feature icon={DollarSign} title="Creator earnings" text="See tips, gifts and withdrawal status." to="/wallet"/>
      <Feature icon={ShieldCheck} title="Verification" text="Apply for your creator verification badge." to="/verification"/>
      <Feature icon={Settings} title="Settings" text="Manage your account and security." to="/settings"/>
    </div>
  </div>
}
function Stat({label,value}){return <div className="stat"><b>{value}</b><span>{label}</span></div>}
function Feature({icon:Icon,title,text,to}){return <Link to={to} className="feature"><Icon/><div><b>{title}</b><p>{text}</p></div></Link>}

function WalletPage({user}) {
  const [wallet,setWallet]=useState(null),[withdrawals,setWithdrawals]=useState([]);
  useEffect(()=>{if(!user)return;Promise.all([
    supabase.from("wallets").select("*").eq("user_id",user.id).maybeSingle(),
    supabase.from("withdrawals").select("*").eq("creator_id",user.id).order("created_at",{ascending:false}).limit(10)
  ]).then(([w,d])=>{setWallet(w.data);setWithdrawals(d.data||[])})},[user]);
  return <div className="page"><PageTitle icon={Wallet} title="Creator Wallet" subtitle="Track coins, tips and withdrawals."/>
    <div className="wallet-hero"><div><span className="muted">Available balance</span><strong>KES {Number(wallet?.available_kes||0).toLocaleString()}</strong></div><Coins size={54}/></div>
    <div className="stats"><Stat label="Coins" value={wallet?.coins||0}/><Stat label="Pending" value={`KES ${wallet?.pending_kes||0}`}/><Stat label="Lifetime" value={`KES ${wallet?.lifetime_earnings_kes||0}`}/></div>
    <div className="section-head"><h2>Withdrawals</h2><Link className="secondary" to="/withdraw">Request withdrawal</Link></div>
    <div className="panel">{withdrawals.length?<table><thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleDateString()}</td><td>KES {x.amount_kes}</td><td><span className="status">{x.status}</span></td></tr>)}</tbody></table>:<Empty title="No withdrawals yet" text="Your approved withdrawals will appear here."/>}</div>
  </div>
}

function Withdraw({user}) {
  const [amount,setAmount]=useState(""),[method,setMethod]=useState("mpesa"),[account,setAccount]=useState(""),[msg,setMsg]=useState("");
  async function submit(e){e.preventDefault();const n=Number(amount);if(n<=0)return;const {error}=await supabase.from("withdrawals").insert({creator_id:user.id,amount_kes:n,payout_method:method,payout_account:account,status:"pending"});setMsg(error?error.message:"Withdrawal request submitted for admin review.");if(!error){setAmount("");setAccount("")}}
  return <div className="page"><PageTitle icon={DollarSign} title="Request withdrawal" subtitle="Withdrawals are reviewed before payout."/><form className="panel stack" onSubmit={submit}><input type="number" min="100" step="1" placeholder="Amount in KES" value={amount} onChange={e=>setAmount(e.target.value)} required/><select value={method} onChange={e=>setMethod(e.target.value)}><option value="mpesa">M-Pesa</option><option value="bank">Bank</option></select><input placeholder="M-Pesa number or bank account" value={account} onChange={e=>setAccount(e.target.value)} required/><button className="primary">Submit request</button>{msg&&<div className="notice">{msg}</div>}</form></div>
}

function Verification({user}) {
  const [reason,setReason]=useState(""),[msg,setMsg]=useState("");
  async function submit(e){e.preventDefault();const {error}=await supabase.from("verification_requests").insert({user_id:user.id,reason,status:"pending"});setMsg(error?error.message:"Application submitted. Admin review is required.");}
  return <div className="page"><PageTitle icon={ShieldCheck} title="Creator verification" subtitle="Build trust with a verified creator badge."/><form className="panel stack" onSubmit={submit}><textarea rows="6" placeholder="Tell us why your account should be verified." value={reason} onChange={e=>setReason(e.target.value)} required/><button className="primary">Apply for verification</button>{msg&&<div className="notice">{msg}</div>}</form></div>
}

function Live({user,profile}) {
  const [title,setTitle]=useState("My live stream"),[room,setRoom]=useState(null),[message,setMessage]=useState(""),[chat,setChat]=useState([]);
  useEffect(()=>{if(!room)return;const channel=supabase.channel(`live-chat-${room.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"live_messages",filter:`live_id=eq.${room.id}`},p=>setChat(c=>[...c,p.new])).subscribe();return()=>supabase.removeChannel(channel)},[room]);
  async function start(){const {data,error}=await supabase.from("live_streams").insert({creator_id:user.id,title,status:"live"}).select().single();if(!error)setRoom(data)}
  async function send(){if(!message.trim()||!room)return;await supabase.from("live_messages").insert({live_id:room.id,user_id:user.id,message});setMessage("")}
  async function stop(){if(room)await supabase.from("live_streams").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",room.id);setRoom(null)}
  return <div className="page"><PageTitle icon={Radio} title="LIVE" subtitle="The app is ready for the live-room layer. Connect a WebRTC provider for real video streaming."/>
    {!room?<div className="panel stack"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Live title"/><button className="primary" onClick={start}><Radio/> Start LIVE room</button><div className="notice">For production video, connect a provider such as LiveKit or Agora and issue room tokens from a secure backend/Edge Function.</div></div>:
    <div className="live-layout"><div className="live-screen"><div className="live-badge">● LIVE</div><Radio size={70}/><h2>{room.title}</h2><p>Live room created. Video transport provider can be connected here.</p><button className="secondary" onClick={stop}>End LIVE</button></div><div className="chat-panel"><h3>Live chat</h3><div className="chat-list">{chat.map(c=><div key={c.id}><b>{c.user_id===user.id?"You":"Viewer"}</b> {c.message}</div>)}</div><div className="chat-input"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Say something…"/><button className="icon-btn" onClick={send}><Send size={18}/></button></div></div></div>}
  </div>
}

function Admin({user}) {
  const [requests,setRequests]=useState([]),[withdrawals,setWithdrawals]=useState([]);
  const load=async()=>{const [v,w]=await Promise.all([supabase.from("verification_requests").select("*,profiles(display_name,email)").order("created_at",{ascending:false}),supabase.from("withdrawals").select("*,profiles(display_name,email)").order("created_at",{ascending:false})]);setRequests(v.data||[]);setWithdrawals(w.data||[])};
  useEffect(()=>{load()},[]);
  async function verify(id,status){await supabase.from("verification_requests").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id);if(status==="approved"){const x=requests.find(r=>r.id===id);if(x)await supabase.from("profiles").update({verified:true}).eq("id",x.user_id)}load()}
  async function withdraw(id,status){await supabase.from("withdrawals").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id);load()}
  return <div className="page"><PageTitle icon={ShieldCheck} title="Admin Dashboard" subtitle="Review verification and withdrawal requests."/>
    <h2>Verification</h2><div className="panel admin-list">{requests.map(r=><div className="admin-row" key={r.id}><div><b>{r.profiles?.display_name||r.user_id}</b><p>{r.reason}</p></div><div className="row"><button className="secondary" onClick={()=>verify(r.id,"approved")}>Approve</button><button className="danger" onClick={()=>verify(r.id,"rejected")}>Reject</button></div></div>)}</div>
    <h2>Withdrawals</h2><div className="panel admin-list">{withdrawals.map(r=><div className="admin-row" key={r.id}><div><b>{r.profiles?.display_name||r.creator_id}</b><p>KES {r.amount_kes} • {r.payout_method} • {r.payout_account}</p></div><div className="row"><button className="secondary" onClick={()=>withdraw(r.id,"approved")}>Approve</button><button className="danger" onClick={()=>withdraw(r.id,"rejected")}>Reject</button></div></div>)}</div>
  </div>
}

function PageTitle({icon:Icon,title,subtitle}){return <div className="page-title"><Icon/><div><h1>{title}</h1><p className="muted">{subtitle}</p></div></div>}
function Simple({title,text,icon:Icon=Settings}){return <div className="page"><PageTitle icon={Icon} title={title} subtitle={text}/><Empty title={title} text="This module is included in the project structure and can be expanded as your platform grows." /></div>}

function App(){
  const {user,profile,loading}=useAuth();
  const path=useLocation().pathname;
  if(loading)return <div className="loading">Loading Owino Live Chat…</div>;
  const publicPaths=["/login","/signup"];
  if(!user && !publicPaths.includes(path)) return <Navigate to="/login" replace/>;
  if(!user) return <Routes><Route path="/login" element={<Auth mode="login"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="*" element={<Navigate to="/login"/>}/></Routes>;
  return <Shell profile={profile}><Routes>
    <Route path="/" element={<Feed/>}/>
    <Route path="/discover" element={<Feed/>}/>
    <Route path="/upload" element={<Upload user={user}/>}/>
    <Route path="/profile" element={<Profile user={user} profile={profile}/>}/>
    <Route path="/wallet" element={<WalletPage user={user}/>}/>
    <Route path="/withdraw" element={<Withdraw user={user}/>}/>
    <Route path="/verification" element={<Verification user={user}/>}/>
    <Route path="/live" element={<Live user={user} profile={profile}/>}/>
    <Route path="/search" element={<Simple title="Search" text="Find creators, videos and live rooms." icon={Search}/>}/>
    <Route path="/notifications" element={<Simple title="Notifications" text="Likes, follows, comments, gifts and system alerts." icon={Bell}/>}/>
    <Route path="/settings" element={<Simple title="Settings" text="Account, privacy, security and notification settings." icon={Settings}/>}/>
    <Route path="/admin" element={profile?.role==="admin"?<Admin user={user}/>:<Navigate to="/" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Shell>
}
export default App;
