import { useState, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVELS = [
  { id: "amateur",  label: "Amateur",  icon: "🌱", color: "#4ade80", desc: "Plain English, no jargon" },
  { id: "beginner", label: "Beginner", icon: "📘", color: "#60a5fa", desc: "Simple terms + basic commands" },
  { id: "semipro",  label: "Semi-Pro", icon: "⚙️", color: "#f59e0b", desc: "Commands with short explanations" },
  { id: "pro",      label: "Pro",      icon: "💻", color: "#a78bfa", desc: "Direct, technical, minimal fluff" },
  { id: "expert",   label: "Expert",   icon: "🔥", color: "#f87171", desc: "Raw output, flags, internals" },
];

const SYSTEM_PROMPTS = {
  amateur:  "You are LinuxPal. User is a complete amateur. Plain everyday English only. No jargon. Use real-life analogies. Explain every part of any command. Be warm, patient, encouraging. Numbered steps.",
  beginner: "You are LinuxPal. User is a beginner. Simple language. Show commands, explain each in plain words right after. Clear steps. Friendly tone.",
  semipro:  "You are LinuxPal. User has intermediate Linux knowledge. Concise but explanatory. Inline command comments. Explain the 'why'. Practical tone.",
  pro:      "You are LinuxPal. User is a professional Linux user. Direct and technical. Full commands with flags. Skip basics unless non-obvious. Reference man pages and config paths.",
  expert:   "You are LinuxPal. User is an expert sysadmin/DevOps. Extremely terse. Raw commands, advanced flags, kernel internals, strace, eBPF as needed. No padding. Peer tone.",
};

const SUGGESTIONS = [
  "permission denied when running my script",
  "how do I list hidden files",
  "my disk is full, what do I do",
  "difference between apt and apt-get",
  "what does chmod 755 mean",
  "how to check which process uses port 3000",
  "my SSH connection keeps dropping",
  "how to set an environment variable permanently",
];

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function askClaude(question, level, history) {
  const sys = SYSTEM_PROMPTS[level] + " Always wrap commands in backticks. Keep responses focused.";
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: question },
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys, messages }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Sorry, no response received.";
}

function renderMessage(text) {
  return text.split(/(`[^`]+`)/g).map((p, i) =>
    p.startsWith("`") && p.endsWith("`")
      ? <code key={i} style={{ background:"#0a1a0a", color:"#4ade80", padding:"2px 7px", borderRadius:"4px", fontFamily:"monospace", fontSize:"0.88em", border:"1px solid #1e3a1e" }}>{p.slice(1,-1)}</code>
      : <span key={i}>{p}</span>
  );
}

function AskBtn({ label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? `${color}22` : `${color}10`, border:`1px solid ${color}44`, color, padding:"9px 16px", borderRadius:"8px", cursor:"pointer", fontSize:"0.8rem", fontWeight:600, transition:"all 0.15s" }}>
      🐧 Ask LinuxPal about this →
    </button>
  );
}

function InfoCard({ label, icon, children }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid #0e2a0e", borderRadius:"10px", padding:"14px 16px", marginBottom:"12px" }}>
      <div style={{ fontSize:"0.65rem", color:"#3a6a3a", marginBottom:"8px", letterSpacing:"0.1em" }}>{icon} {label}</div>
      {children}
    </div>
  );
}

// ─── FILE SYSTEM GUIDE ────────────────────────────────────────────────────────
const FS_NODES = [
  { path:"/",     icon:"🌳", color:"#4ade80", title:"/ — Root", simple:"The very top of everything. Like the trunk of a tree — all folders branch from here.", detail:"The root of the entire Linux file system. Every file and device lives under /. Unlike Windows (C:\\, D:\\), Linux has one single tree starting here.", commands:[] },
  { path:"/home", icon:"🏠", color:"#60a5fa", title:"/home — Your Personal Space", simple:"Where your personal files live. Like 'My Documents' in Windows. Each user gets their own folder here.", detail:"Each user gets /home/username. Your documents, downloads, configs, and projects live here. You own this space — no root permission needed.", commands:["cd ~","ls -la ~","cd /home/yourname"] },
  { path:"/root", icon:"👑", color:"#f87171", title:"/root — Admin's Home", simple:"The home folder for the system administrator. Regular users cannot enter here.", detail:"Home directory for the root (superuser) account. Kept separate from /home for security. Even if /home fails, root can still log in and fix things.", commands:["sudo ls /root"] },
  { path:"/etc",  icon:"⚙️", color:"#f59e0b", title:"/etc — All Config Files", simple:"Every program's settings file lives here. Like a 'Settings' folder for the whole system.", detail:"/etc/hosts controls DNS. /etc/fstab controls disk mounts. /etc/ssh/sshd_config controls SSH. When something behaves wrongly, check here first.", commands:["cat /etc/hosts","cat /etc/os-release","ls /etc/"] },
  { path:"/bin",  icon:"🔧", color:"#a78bfa", title:"/bin — Basic Commands", simple:"The everyday tools: ls, cp, mv, cat. These must work even if the rest of the system is broken.", detail:"Essential user binaries. Commands here work even in recovery mode. In modern distros /bin is often a symlink to /usr/bin. Contains bash, ls, cp, mv, grep, cat, chmod.", commands:["ls /bin","which ls"] },
  { path:"/usr",  icon:"📦", color:"#34d399", title:"/usr — Installed Programs", simple:"Where bigger programs you install end up. Like 'Program Files' on Windows.", detail:"/usr/bin holds most installed programs. /usr/lib holds their libraries. /usr/share has docs and data. /usr/local is for software you compiled yourself.", commands:["ls /usr/bin","which python3","du -sh /usr"] },
  { path:"/var",  icon:"📝", color:"#fb923c", title:"/var — Changing Data", simple:"Files that keep changing — logs, emails, database files. 'var' means variable.", detail:"/var/log has all system logs. /var/www is where web files often live. /var/lib holds databases. This grows large — disk-full errors often start here.", commands:["tail -f /var/log/syslog","ls /var/log","du -sh /var/*"] },
  { path:"/tmp",  icon:"🗑️", color:"#94a3b8", title:"/tmp — Temporary Files", simple:"Scratch paper. Files here are wiped when you reboot. Never save anything important here.", detail:"World-writable directory for temporary files. Cleared on every reboot. Programs store temp data here during work. Safe to delete contents manually.", commands:["ls /tmp","df -h /tmp"] },
  { path:"/dev",  icon:"🔌", color:"#e879f9", title:"/dev — Hardware as Files", simple:"Your hardware shown as files. Your hard disk is a file. Your USB stick is a file. This is a Linux superpower.", detail:"/dev/sda is your first disk. /dev/sda1 is its first partition. /dev/null is a black hole (discards output). /dev/random generates random bytes. Everything is a file.", commands:["ls /dev","lsblk"] },
  { path:"/proc", icon:"🧠", color:"#22d3ee", title:"/proc — Live System Info", simple:"A live window into your running system. CPU info, RAM, processes — all updated every second.", detail:"A virtual filesystem — nothing stored on disk. /proc/cpuinfo shows CPU details. /proc/meminfo shows RAM. /proc/[PID]/ contains info about any running process.", commands:["cat /proc/cpuinfo","cat /proc/meminfo","cat /proc/uptime"] },
  { path:"/mnt",  icon:"💾", color:"#facc15", title:"/mnt — Mount Point", simple:"Where you 'plug in' extra drives or USB sticks. Like inserting a memory card — it shows up here.", detail:"Used to manually mount filesystems. `mount /dev/sdb1 /mnt` makes a drive accessible. Modern systems use /media for auto-mounted USB. WSL mounts Windows drives here (/mnt/c).", commands:["mount | grep /mnt","df -h","ls /mnt"] },
  { path:"/opt",  icon:"📁", color:"#a3e635", title:"/opt — Optional Software", simple:"Where big third-party programs install themselves — Chrome, VS Code, etc.", detail:"Optional add-on software not part of the default OS. Each program usually gets its own subdirectory: /opt/google/chrome, /opt/vscode.", commands:["ls /opt"] },
];

function FilesystemGuide({ onAskAbout }) {
  const [sel, setSel] = useState("/");
  const node = FS_NODES.find(n => n.path === sel) || FS_NODES[0];
  return (
    <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
      <div style={{ width:220, flexShrink:0, borderRight:"1px solid #0e2a0e", overflowY:"auto", background:"rgba(0,0,0,0.3)", padding:"8px 0" }}>
        <div style={{ padding:"4px 14px 8px", fontSize:"0.62rem", color:"#2a4a2a", letterSpacing:"0.1em" }}>FS TREE</div>
        {FS_NODES.map(n => (
          <div key={n.path} onClick={() => setSel(n.path)} style={{ padding: n.path==="/" ? "9px 14px" : "8px 14px 8px 28px", display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", background: sel===n.path ? `${n.color}12` : "transparent", borderLeft: sel===n.path ? `2px solid ${n.color}` : "2px solid transparent", transition:"all 0.12s" }}>
            <span style={{ fontSize:"14px" }}>{n.icon}</span>
            <span style={{ fontSize:"0.8rem", fontFamily:"monospace", fontWeight: sel===n.path ? 600 : 400, color: sel===n.path ? n.color : "#4a6a4a" }}>{n.path}</span>
          </div>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
        <div style={{ maxWidth:560 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"18px" }}>
            <div style={{ width:44, height:44, borderRadius:"10px", background:`${node.color}14`, border:`1.5px solid ${node.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px" }}>{node.icon}</div>
            <h2 style={{ margin:0, color:node.color, fontSize:"1.1rem", fontFamily:"monospace" }}>{node.title}</h2>
          </div>
          <InfoCard label="PLAIN ENGLISH" icon="🌱"><p style={{ margin:0, color:"#a0c8a0", fontSize:"0.88rem", lineHeight:1.7 }}>{node.simple}</p></InfoCard>
          <InfoCard label="TECHNICAL DETAIL" icon="💻"><p style={{ margin:0, color:"#7a9a7a", fontSize:"0.84rem", lineHeight:1.7 }}>{node.detail}</p></InfoCard>
          {node.commands.length > 0 && (
            <InfoCard label="TRY THESE COMMANDS" icon="⌨️">
              {node.commands.map((c,i) => <div key={i} style={{ fontFamily:"monospace", fontSize:"0.84rem", color:"#4ade80", padding:"4px 0", borderBottom: i<node.commands.length-1 ? "1px solid #0a1a0a":"none" }}><span style={{ color:"#2a5a2a", marginRight:8 }}>$</span>{c}</div>)}
            </InfoCard>
          )}
          <AskBtn label={node.path} color={node.color} onClick={() => onAskAbout(`Explain the ${node.path} directory in Linux in detail`)} />
        </div>
      </div>
    </div>
  );
}

// ─── PERMISSIONS GUIDE ────────────────────────────────────────────────────────
const PERM_BITS = [
  { bits:"rwx", num:"7", label:"Full access", color:"#f87171", simple:"Read, write, and run. Full control." },
  { bits:"rw-", num:"6", label:"Read & Write", color:"#fb923c", simple:"Can open and edit, but cannot run as a program." },
  { bits:"r-x", num:"5", label:"Read & Execute", color:"#facc15", simple:"Can open and run, but cannot edit." },
  { bits:"r--", num:"4", label:"Read only",   color:"#4ade80", simple:"Can only look at it. Cannot change or run." },
  { bits:"---", num:"0", label:"No access",   color:"#3a4a3a", simple:"Completely blocked. Cannot do anything." },
];

const COMMON_PERMS = [
  { perm:"755", use:"Scripts and programs", who:"Owner: full · Group: read+run · Others: read+run", example:"chmod 755 myscript.sh" },
  { perm:"644", use:"Normal files (configs, docs)", who:"Owner: read+write · Group: read · Others: read", example:"chmod 644 config.txt" },
  { perm:"700", use:"Private scripts", who:"Owner: full · Group: none · Others: none", example:"chmod 700 private.sh" },
  { perm:"600", use:"Private files (SSH keys)", who:"Owner: read+write · Group: none · Others: none", example:"chmod 600 ~/.ssh/id_rsa" },
  { perm:"777", use:"Fully open (avoid!)", who:"Everyone: full access — security risk", example:"chmod 777 folder/" },
];

function PermissionsGuide({ onAskAbout }) {
  const [example, setExample] = useState("rwxr-xr--");
  const [selPerm, setSelPerm] = useState(null);

  const parseTriple = (str) => [str.slice(0,3), str.slice(3,6), str.slice(6,9)];
  const [owner, group, others] = parseTriple(example.padEnd(9,"-").slice(0,9));

  const BitGroup = ({ label, bits, color }) => (
    <div style={{ textAlign:"center", flex:1 }}>
      <div style={{ fontSize:"0.65rem", color:"#3a5a3a", marginBottom:"6px", letterSpacing:"0.08em" }}>{label}</div>
      <div style={{ display:"flex", gap:"4px", justifyContent:"center" }}>
        {bits.split("").map((b,i) => {
          const active = b !== "-";
          const labels = ["r","w","x"];
          const colors = ["#60a5fa","#fb923c","#4ade80"];
          return (
            <div key={i} style={{ width:36, height:36, borderRadius:"6px", background: active ? `${colors[i]}22` : "#0a1a0a", border:`1.5px solid ${active ? colors[i] : "#1a2a1a"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:"1rem", color: active ? colors[i] : "#2a3a2a", fontWeight:600 }}>{labels[i]}</div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ maxWidth:620, margin:"0 auto" }}>
        <h2 style={{ color:"#a78bfa", fontSize:"1.1rem", margin:"0 0 4px", fontFamily:"monospace" }}>🔐 Linux Permissions</h2>
        <p style={{ color:"#3a5a3a", fontSize:"0.8rem", margin:"0 0 20px" }}>Every file has 3 sets of permissions: Owner · Group · Others</p>

        {/* Live visualiser */}
        <InfoCard label="PERMISSION VISUALISER — click to try" icon="🎛️">
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"14px" }}>
            {["rwxrwxrwx","rwxr-xr-x","rw-r--r--","rwx------","r--------"].map(p => (
              <button key={p} onClick={() => setExample(p)} style={{ fontFamily:"monospace", fontSize:"0.8rem", padding:"4px 10px", borderRadius:"6px", background: example===p ? "#a78bfa22":"transparent", border:`1px solid ${example===p?"#a78bfa":"#1a3a1a"}`, color: example===p?"#a78bfa":"#4a6a4a", cursor:"pointer" }}>{p}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:"12px", background:"#050f05", borderRadius:"8px", padding:"16px" }}>
            <BitGroup label="OWNER" bits={owner} />
            <div style={{ width:1, background:"#1a2a1a" }} />
            <BitGroup label="GROUP" bits={group} />
            <div style={{ width:1, background:"#1a2a1a" }} />
            <BitGroup label="OTHERS" bits={others} />
          </div>
          <div style={{ marginTop:"10px", fontFamily:"monospace", fontSize:"1.2rem", textAlign:"center", color:"#c0d4c0", letterSpacing:"4px" }}>{example}</div>
        </InfoCard>

        {/* Bit reference */}
        <InfoCard label="WHAT EACH NUMBER MEANS" icon="🔢">
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {PERM_BITS.map(b => (
              <div key={b.num} style={{ flex:"1 1 140px", background:"#050f05", borderRadius:"8px", padding:"10px 12px", border:`1px solid ${b.color}33` }}>
                <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"4px" }}>
                  <span style={{ fontFamily:"monospace", color:b.color, fontSize:"1rem", fontWeight:700 }}>{b.bits}</span>
                  <span style={{ background:`${b.color}22`, color:b.color, fontFamily:"monospace", fontWeight:700, padding:"1px 7px", borderRadius:"4px", fontSize:"0.9rem" }}>{b.num}</span>
                </div>
                <div style={{ fontSize:"0.75rem", color:"#5a7a5a" }}>{b.simple}</div>
              </div>
            ))}
          </div>
        </InfoCard>

        {/* Common patterns */}
        <InfoCard label="MOST COMMON PERMISSIONS" icon="📋">
          {COMMON_PERMS.map((p,i) => (
            <div key={i} onClick={() => setSelPerm(selPerm===p.perm ? null : p.perm)} style={{ padding:"10px 12px", borderRadius:"8px", cursor:"pointer", background: selPerm===p.perm ? "rgba(167,139,250,0.08)":"transparent", border: selPerm===p.perm ? "1px solid #a78bfa44":"1px solid transparent", marginBottom:"4px", transition:"all 0.12s" }}>
              <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <span style={{ fontFamily:"monospace", fontSize:"1.1rem", color:"#a78bfa", fontWeight:700, minWidth:34 }}>{p.perm}</span>
                <div>
                  <div style={{ fontSize:"0.83rem", color:"#a0b8a0", fontWeight:600 }}>{p.use}</div>
                  {selPerm===p.perm && <div style={{ fontSize:"0.76rem", color:"#5a7a5a", marginTop:"4px" }}>{p.who}<br/><code style={{ color:"#4ade80", fontFamily:"monospace", fontSize:"0.8rem" }}>{p.example}</code></div>}
                </div>
              </div>
            </div>
          ))}
        </InfoCard>

        {/* chown */}
        <InfoCard label="CHANGING OWNERSHIP (chown)" icon="👤">
          <div style={{ fontFamily:"monospace", fontSize:"0.84rem", color:"#4ade80", lineHeight:2 }}>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>chown username file.txt</div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>chown username:groupname file.txt</div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>chown -R username /folder/</div>
          </div>
          <p style={{ margin:"10px 0 0", fontSize:"0.78rem", color:"#4a6a4a" }}>-R means "apply to everything inside the folder too"</p>
        </InfoCard>

        <AskBtn label="permissions" color="#a78bfa" onClick={() => onAskAbout("Explain Linux file permissions, chmod, and chown in detail")} />
      </div>
    </div>
  );
}

// ─── PROCESSES GUIDE ──────────────────────────────────────────────────────────
const PROC_STATES = [
  { state:"Running",  icon:"▶️",  color:"#4ade80", letter:"R", desc:"Actively using the CPU right now." },
  { state:"Sleeping", icon:"💤", color:"#60a5fa", letter:"S", desc:"Waiting for something (input, network, disk). Most processes are here." },
  { state:"Stopped",  icon:"⏸️",  color:"#f59e0b", letter:"T", desc:"Paused. You pressed Ctrl+Z. Resume with fg or bg." },
  { state:"Zombie",   icon:"🧟", color:"#f87171", letter:"Z", desc:"Finished but parent hasn't acknowledged it yet. Usually harmless." },
];

const SIGNALS = [
  { sig:"SIGTERM (15)", cmd:"kill PID",    color:"#4ade80", desc:"Politely ask the process to stop. It can clean up first." },
  { sig:"SIGKILL (9)",  cmd:"kill -9 PID", color:"#f87171", desc:"Force kill immediately. No cleanup. Last resort." },
  { sig:"SIGHUP (1)",   cmd:"kill -1 PID", color:"#60a5fa", desc:"Hang up. Many daemons reload config when they get this." },
  { sig:"SIGSTOP",      cmd:"kill -19 PID",color:"#f59e0b", desc:"Pause a process. Like Ctrl+Z but from another terminal." },
];

function ProcessesGuide({ onAskAbout }) {
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ maxWidth:620, margin:"0 auto" }}>
        <h2 style={{ color:"#34d399", fontSize:"1.1rem", margin:"0 0 4px", fontFamily:"monospace" }}>⚙️ Linux Processes</h2>
        <p style={{ color:"#3a5a3a", fontSize:"0.8rem", margin:"0 0 20px" }}>A process is any running program. Every process has a unique ID called a PID.</p>

        <InfoCard label="WHAT IS A PID?" icon="🔢">
          <p style={{ margin:0, color:"#a0c8a0", fontSize:"0.87rem", lineHeight:1.7 }}>
            PID stands for <strong style={{ color:"#34d399" }}>Process ID</strong>. Every program running on your system gets a unique number. PID 1 is always the first process (systemd or init). All other processes are "children" of PID 1.
          </p>
          <div style={{ marginTop:"10px", fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2 }}>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>echo $$    <span style={{ color:"#2a4a2a" }}># your current shell's PID</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>ps aux    <span style={{ color:"#2a4a2a" }}># all running processes</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>pstree    <span style={{ color:"#2a4a2a" }}># show process family tree</span></div>
          </div>
        </InfoCard>

        <InfoCard label="PROCESS STATES" icon="🚦">
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {PROC_STATES.map(s => (
              <div key={s.state} style={{ flex:"1 1 200px", background:"#050f05", borderRadius:"8px", padding:"10px 12px", border:`1px solid ${s.color}33` }}>
                <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"5px" }}>
                  <span style={{ fontSize:"18px" }}>{s.icon}</span>
                  <span style={{ color:s.color, fontWeight:700, fontSize:"0.9rem" }}>{s.state}</span>
                  <span style={{ marginLeft:"auto", fontFamily:"monospace", background:`${s.color}22`, color:s.color, padding:"1px 7px", borderRadius:"4px", fontSize:"0.8rem" }}>{s.letter}</span>
                </div>
                <p style={{ margin:0, fontSize:"0.76rem", color:"#4a6a4a" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard label="KEY COMMANDS" icon="⌨️">
          {[
            ["ps aux",             "Show all running processes with details"],
            ["top",                "Live process monitor — like Task Manager"],
            ["htop",               "Better top — colorful, easier to read"],
            ["pgrep nginx",        "Find PID of a process by name"],
            ["kill 1234",          "Stop process with PID 1234 (politely)"],
            ["kill -9 1234",       "Force kill process 1234"],
            ["pkill nginx",        "Kill all processes named nginx"],
            ["jobs",               "List processes paused in background"],
            ["fg",                 "Bring background process to foreground"],
            ["bg",                 "Resume paused process in background"],
            ["nohup ./script.sh &","Run script that survives logout"],
          ].map(([cmd, desc], i, arr) => (
            <div key={i} style={{ display:"flex", gap:"12px", padding:"7px 0", borderBottom: i<arr.length-1?"1px solid #0a1a0a":"none", alignItems:"center" }}>
              <code style={{ color:"#4ade80", fontFamily:"monospace", fontSize:"0.8rem", minWidth:180, flexShrink:0 }}>{cmd}</code>
              <span style={{ color:"#4a6a4a", fontSize:"0.78rem" }}>{desc}</span>
            </div>
          ))}
        </InfoCard>

        <InfoCard label="KILL SIGNALS — how to stop a process" icon="⚡">
          {SIGNALS.map((s,i) => (
            <div key={i} style={{ padding:"9px 0", borderBottom: i<SIGNALS.length-1?"1px solid #0a1a0a":"none" }}>
              <div style={{ display:"flex", gap:"10px", alignItems:"center", marginBottom:"3px" }}>
                <span style={{ fontFamily:"monospace", color:s.color, fontWeight:700, fontSize:"0.82rem", minWidth:110 }}>{s.sig}</span>
                <code style={{ color:"#4ade80", fontFamily:"monospace", fontSize:"0.8rem" }}>{s.cmd}</code>
              </div>
              <p style={{ margin:0, fontSize:"0.76rem", color:"#4a6a4a", paddingLeft:120 }}>{s.desc}</p>
            </div>
          ))}
        </InfoCard>

        <InfoCard label="BACKGROUND vs FOREGROUND" icon="🔄">
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>./script.sh          <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.76rem" }}># runs in foreground (blocks terminal)</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>./script.sh &amp;         <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.76rem" }}># & puts it in background</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>Ctrl + Z              <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.76rem" }}># pause current foreground process</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>bg                    <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.76rem" }}># resume it in background</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>fg                    <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.76rem" }}># bring background job to front</span></div>
          </div>
        </InfoCard>

        <AskBtn label="processes" color="#34d399" onClick={() => onAskAbout("Explain Linux processes, PIDs, and how to manage them with kill, ps, top, and fg/bg")} />
      </div>
    </div>
  );
}

// ─── NETWORKING GUIDE ─────────────────────────────────────────────────────────
const PORTS = [
  { port:22,   name:"SSH",   color:"#4ade80",  desc:"Secure remote login" },
  { port:80,   name:"HTTP",  color:"#60a5fa",  desc:"Web traffic (unencrypted)" },
  { port:443,  name:"HTTPS", color:"#34d399",  desc:"Web traffic (encrypted)" },
  { port:21,   name:"FTP",   color:"#f59e0b",  desc:"File transfer" },
  { port:25,   name:"SMTP",  color:"#fb923c",  desc:"Email sending" },
  { port:3306, name:"MySQL", color:"#e879f9",  desc:"MySQL database" },
  { port:5432, name:"PG",    color:"#a78bfa",  desc:"PostgreSQL database" },
  { port:6379, name:"Redis", color:"#f87171",  desc:"Redis cache/store" },
];

function NetworkingGuide({ onAskAbout }) {
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ maxWidth:620, margin:"0 auto" }}>
        <h2 style={{ color:"#22d3ee", fontSize:"1.1rem", margin:"0 0 4px", fontFamily:"monospace" }}>🌐 Linux Networking</h2>
        <p style={{ color:"#3a5a3a", fontSize:"0.8rem", margin:"0 0 20px" }}>The commands every Linux user needs for network diagnostics and configuration.</p>

        <InfoCard label="THE BASICS — what is your machine?" icon="🖥️">
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            {[
              ["ip addr",                 "Your IP address(es) — the new way"],
              ["ifconfig",                "Your IP address(es) — the old way"],
              ["hostname",                "Your machine's name on the network"],
              ["hostname -I",             "Just print IP addresses, nothing else"],
              ["cat /etc/hosts",          "Local DNS — name to IP mappings"],
              ["cat /etc/resolv.conf",    "Which DNS server your system uses"],
            ].map(([cmd, desc], i) => (
              <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <span style={{ minWidth:200, flexShrink:0 }}><span style={{ color:"#2a5a2a" }}>$ </span>{cmd}</span>
                <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}>{desc}</span>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard label="TESTING CONNECTIVITY" icon="📡">
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            {[
              ["ping google.com",              "Is the internet reachable? (Ctrl+C to stop)"],
              ["ping -c 4 8.8.8.8",            "Ping exactly 4 times then stop"],
              ["traceroute google.com",         "See every hop your packet takes"],
              ["curl -I https://google.com",    "Check if a website responds (headers only)"],
              ["wget https://example.com/file", "Download a file from the internet"],
              ["nslookup google.com",           "DNS lookup — what IP does this name resolve to"],
              ["dig google.com",                "Detailed DNS lookup (better than nslookup)"],
            ].map(([cmd, desc], i) => (
              <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <span style={{ minWidth:240, flexShrink:0 }}><span style={{ color:"#2a5a2a" }}>$ </span>{cmd}</span>
                <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}>{desc}</span>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard label="PORTS — what's listening?" icon="🔌">
          <p style={{ margin:"0 0 12px", fontSize:"0.8rem", color:"#4a6a4a" }}>A port is like a door number on your computer. Programs "listen" on a port to receive connections.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"7px", marginBottom:"14px" }}>
            {PORTS.map(p => (
              <div key={p.port} style={{ background:"#050f05", border:`1px solid ${p.color}33`, borderRadius:"8px", padding:"7px 11px", minWidth:80 }}>
                <div style={{ fontFamily:"monospace", color:p.color, fontWeight:700, fontSize:"0.9rem" }}>{p.port}</div>
                <div style={{ fontSize:"0.7rem", color:p.color, opacity:0.7, marginBottom:"2px" }}>{p.name}</div>
                <div style={{ fontSize:"0.68rem", color:"#3a5a3a" }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>ss -tlnp          <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}># all listening ports (modern)</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>netstat -tlnp     <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}># all listening ports (older)</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>lsof -i :3000     <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}># what's using port 3000?</span></div>
            <div><span style={{ color:"#2a5a2a" }}>$ </span>fuser 3000/tcp    <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}># PID using port 3000</span></div>
          </div>
        </InfoCard>

        <InfoCard label="SSH — REMOTE ACCESS" icon="🔑">
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            {[
              ["ssh user@192.168.1.10",          "Login to remote machine by IP"],
              ["ssh user@hostname",              "Login to remote machine by name"],
              ["ssh -p 2222 user@host",          "SSH on a non-standard port"],
              ["ssh-keygen",                     "Create your SSH key pair"],
              ["ssh-copy-id user@host",          "Copy your key so you don't need password"],
              ["scp file.txt user@host:/path/",  "Copy a file to a remote machine"],
              ["rsync -avz ./folder user@host:", "Sync a folder to remote (faster than scp)"],
            ].map(([cmd, desc], i) => (
              <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <span style={{ minWidth:240, flexShrink:0 }}><span style={{ color:"#2a5a2a" }}>$ </span>{cmd}</span>
                <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}>{desc}</span>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard label="FIREWALL BASICS (ufw)" icon="🛡️">
          <div style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#4ade80", lineHeight:2.2 }}>
            {[
              ["ufw status",            "Is firewall on? What rules exist?"],
              ["ufw enable",            "Turn firewall on"],
              ["ufw allow 22",          "Allow SSH (do this BEFORE enabling!)"],
              ["ufw allow 80",          "Allow web traffic"],
              ["ufw allow 443",         "Allow HTTPS"],
              ["ufw deny 3306",         "Block MySQL from outside"],
              ["ufw delete allow 80",   "Remove a rule"],
            ].map(([cmd, desc], i) => (
              <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <span style={{ minWidth:210, flexShrink:0 }}><span style={{ color:"#2a5a2a" }}>$ </span>{cmd}</span>
                <span style={{ color:"#2a4a2a", fontFamily:"sans-serif", fontSize:"0.75rem" }}>{desc}</span>
              </div>
            ))}
          </div>
          <p style={{ margin:"10px 0 0", fontSize:"0.75rem", color:"#5a3a3a" }}>⚠️ Always allow port 22 BEFORE enabling ufw or you'll lock yourself out of SSH!</p>
        </InfoCard>

        <AskBtn label="networking" color="#22d3ee" onClick={() => onAskAbout("Explain Linux networking basics — IP addresses, ports, SSH, and firewall with ufw")} />
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = [
  { id:"chat", label:"💬 AI Chat" },
  { id:"fs",   label:"🗂️ File System" },
  { id:"perm", label:"🔐 Permissions" },
  { id:"proc", label:"⚙️ Processes" },
  { id:"net",  label:"🌐 Networking" },
];

export default function LinuxPal() {
  const [tab,    setTab]    = useState("chat");
  const [level,  setLevel]  = useState("beginner");
  const [input,  setInput]  = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showSug, setShowSug]   = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const currentLevel = LEVELS.find(l => l.id === level);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput(""); setShowSug(false); setTab("chat");
    const history = messages.map(m => ({ role:m.role, content:m.content }));
    setMessages(prev => [...prev, { role:"user", content:q, id:Date.now() }]);
    setLoading(true);
    try {
      const answer = await askClaude(q, level, history);
      setMessages(prev => [...prev, { role:"assistant", content:answer, id:Date.now()+1, level }]);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"⚠️ Connection error. Please try again.", id:Date.now()+1, level }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const reset = () => { setMessages([]); setShowSug(true); setInput(""); };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#020c05", backgroundImage:"radial-gradient(ellipse at 20% 10%,#0a2918 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,#0d1f0a 0%,transparent 50%)", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#d4f0d4", overflow:"hidden" }}>

      {/* HEADER */}
      <div style={{ borderBottom:"1px solid #1a3a1a", background:"rgba(0,0,0,0.65)", backdropFilter:"blur(10px)", padding:"10px 18px", display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
        <div style={{ width:32, height:32, background:"linear-gradient(135deg,#4ade80,#16a34a)", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", boxShadow:"0 0 14px #4ade8044", flexShrink:0 }}>🐧</div>
        <div>
          <div style={{ fontSize:"1rem", fontWeight:700, color:"#4ade80", letterSpacing:"-0.02em" }}>LinuxPal</div>
          <div style={{ fontSize:"0.62rem", color:"#2a5a2a", letterSpacing:"0.08em" }}>OPEN SOURCE · AI-POWERED · FOR EVERY LEVEL</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:"7px" }}>
          {messages.length > 0 && tab==="chat" && <button onClick={reset} style={{ background:"transparent", border:"1px solid #1e3a1e", color:"#3a5a3a", padding:"4px 11px", borderRadius:"6px", cursor:"pointer", fontSize:"0.74rem" }}>↺ New</button>}
          <a href="https://github.com" target="_blank" rel="noreferrer" style={{ background:"transparent", border:"1px solid #1e3a1e", color:"#3a5a3a", padding:"4px 11px", borderRadius:"6px", fontSize:"0.74rem", textDecoration:"none" }}>⭐ GitHub</a>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{ borderBottom:"1px solid #0e2a0e", background:"rgba(0,0,0,0.3)", padding:"0 14px", display:"flex", gap:"2px", overflowX:"auto", scrollbarWidth:"none", flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"9px 14px", background:"transparent", border:"none", borderBottom: tab===t.id ? "2px solid #4ade80":"2px solid transparent", color: tab===t.id ? "#4ade80":"#3a5a3a", cursor:"pointer", fontSize:"0.78rem", fontWeight: tab===t.id ? 600:400, whiteSpace:"nowrap", transition:"all 0.15s" }}>{t.label}</button>
        ))}
      </div>

      {/* LEVEL BAR — chat only */}
      {tab==="chat" && (
        <div style={{ padding:"8px 16px", background:"rgba(0,0,0,0.25)", borderBottom:"1px solid #0a1e0a", display:"flex", gap:"6px", overflowX:"auto", scrollbarWidth:"none", flexShrink:0, alignItems:"center" }}>
          {LEVELS.map(l => (
            <button key={l.id} onClick={() => setLevel(l.id)} style={{ padding:"5px 12px", borderRadius:"20px", whiteSpace:"nowrap", border: level===l.id ? `1.5px solid ${l.color}`:"1.5px solid #1a3a1a", background: level===l.id ? `${l.color}16`:"transparent", color: level===l.id ? l.color:"#3a5a3a", cursor:"pointer", fontSize:"0.76rem", fontWeight: level===l.id ? 600:400, transition:"all 0.15s" }}>{l.icon} {l.label}</button>
          ))}
          <span style={{ marginLeft:"auto", fontSize:"0.68rem", color:"#2a4a2a", whiteSpace:"nowrap" }}>{currentLevel.desc}</span>
        </div>
      )}

      {/* GUIDE TABS */}
      {tab==="fs"   && <FilesystemGuide   onAskAbout={send} />}
      {tab==="perm" && <PermissionsGuide  onAskAbout={send} />}
      {tab==="proc" && <ProcessesGuide    onAskAbout={send} />}
      {tab==="net"  && <NetworkingGuide   onAskAbout={send} />}

      {/* CHAT TAB */}
      {tab==="chat" && (
        <>
          <div style={{ flex:1, overflowY:"auto", padding:"18px", display:"flex", flexDirection:"column", gap:"12px" }}>
            {messages.length===0 && (
              <div style={{ textAlign:"center", padding:"24px 20px 6px" }}>
                <div style={{ fontSize:"2rem", marginBottom:"8px" }}>🐧</div>
                <h2 style={{ color:"#4ade80", fontSize:"1.2rem", fontWeight:700, margin:"0 0 5px" }}>Welcome to LinuxPal</h2>
                <p style={{ color:"#2a5a2a", fontSize:"0.82rem", maxWidth:"340px", margin:"0 auto" }}>Ask anything Linux. Or explore the guides above — File System, Permissions, Processes, Networking.</p>
              </div>
            )}
            {showSug && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", justifyContent:"center", padding:"6px 0" }}>
                {SUGGESTIONS.map((s,i) => (
                  <button key={i} onClick={() => send(s)} style={{ background:"rgba(74,222,128,0.03)", border:"1px solid #1a3a1a", color:"#3a5a3a", padding:"6px 11px", borderRadius:"8px", cursor:"pointer", fontSize:"0.74rem", transition:"all 0.12s" }}
                    onMouseEnter={e=>{e.target.style.borderColor="#4ade8044";e.target.style.color="#4ade80";}}
                    onMouseLeave={e=>{e.target.style.borderColor="#1a3a1a";e.target.style.color="#3a5a3a";}}
                  >{s}</button>
                ))}
              </div>
            )}
            {messages.map(msg => {
              const isUser = msg.role==="user";
              const ml = LEVELS.find(l => l.id===msg.level);
              return (
                <div key={msg.id} style={{ display:"flex", justifyContent: isUser?"flex-end":"flex-start", gap:"8px", alignItems:"flex-start" }}>
                  {!isUser && <div style={{ width:26, height:26, flexShrink:0, background:"linear-gradient(135deg,#4ade80,#16a34a)", borderRadius:"7px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>🐧</div>}
                  <div style={{ maxWidth:"76%", background: isUser?"rgba(74,222,128,0.07)":"rgba(255,255,255,0.025)", border: isUser?"1px solid #1e4a1e":"1px solid #0f1f0f", borderRadius: isUser?"13px 4px 13px 13px":"4px 13px 13px 13px", padding:"10px 14px", fontSize:"0.86rem", lineHeight:1.65, color: isUser?"#a0e8a0":"#b4d0b4" }}>
                    {!isUser && ml && <div style={{ fontSize:"0.64rem", color:ml.color, marginBottom:"4px", opacity:0.7 }}>{ml.icon} {ml.label} mode</div>}
                    <div style={{ whiteSpace:"pre-wrap" }}>{isUser ? msg.content : renderMessage(msg.content)}</div>
                  </div>
                  {isUser && <div style={{ width:26, height:26, flexShrink:0, background:"#1a3a1a", borderRadius:"7px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>👤</div>}
                </div>
              );
            })}
            {loading && (
              <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <div style={{ width:26, height:26, flexShrink:0, background:"linear-gradient(135deg,#4ade80,#16a34a)", borderRadius:"7px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>🐧</div>
                <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid #0f1f0f", borderRadius:"4px 13px 13px 13px", padding:"12px 16px", display:"flex", gap:"5px", alignItems:"center" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, background:"#4ade80", borderRadius:"50%", opacity:0.7, animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* INPUT */}
          <div style={{ padding:"11px 16px", borderTop:"1px solid #0e2a0e", background:"rgba(0,0,0,0.5)", backdropFilter:"blur(10px)", display:"flex", gap:"8px", flexShrink:0 }}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder={`Ask LinuxPal... (${currentLevel.icon} ${currentLevel.label})`}
              style={{ flex:1, background:"rgba(74,222,128,0.03)", border:"1px solid #1a3a1a", borderRadius:"10px", padding:"10px 14px", color:"#b4d0b4", fontSize:"0.85rem", outline:"none", fontFamily:"inherit" }}
              onFocus={e=>e.target.style.borderColor="#4ade8044"} onBlur={e=>e.target.style.borderColor="#1a3a1a"} />
            <button onClick={()=>send()} disabled={!input.trim()||loading} style={{ background: input.trim()&&!loading?"linear-gradient(135deg,#4ade80,#16a34a)":"#1a3a1a", border:"none", borderRadius:"10px", padding:"10px 15px", color: input.trim()&&!loading?"#000":"#2a4a2a", cursor: input.trim()&&!loading?"pointer":"default", fontWeight:600, fontSize:"0.84rem", transition:"all 0.15s", boxShadow: input.trim()&&!loading?"0 0 12px #4ade8033":"none" }}>Send ↑</button>
          </div>
        </>
      )}

      {/* FOOTER */}
      <div style={{ textAlign:"center", padding:"5px", fontSize:"0.63rem", color:"#192619", borderTop:"1px solid #070d07", flexShrink:0 }}>
        LinuxPal · Open Source · MIT License · Built with ❤️ for the Linux community
      </div>

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(0.8);opacity:0.4}50%{transform:scale(1.2);opacity:1}}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1a3a1a;border-radius:4px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>
    </div>
  );
}
