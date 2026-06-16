"use client";
/* Arc Payroll — batch salary. Layout theo ảnh 4 (DASHBOARD xanh dương): stat cards + bảng runs
   (add recipient + fund&pay) + tạo run. Self-contained.
   ABI preserved: createRun(name)/addRecipient(id,to,amount)/fundAndPay(id)payable/get/count/total. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "createRun", type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "addRecipient", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "fundAndPay", type: "function", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "name", type: "string" }, { name: "totalAmt", type: "uint256" }, { name: "paid", type: "bool" }, { name: "at", type: "uint256" }] }] },
  { name: "count", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.pr{--bg:#070d1a;--pan:#0e1830;--pan2:#13203c;--bd:#1c2c4c;--bd2:#27395e;--mut:#7d92bb;--txt:#e9f0fb;--acc:#3b82f6;--acc2:#60a5fa;--up:#22c55e;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.pr *{box-sizing:border-box}.pr a{color:var(--acc2);text-decoration:none}.pr .mono{font-family:ui-monospace,monospace}
.pr header{display:flex;align-items:center;gap:12px;padding:13px 22px;border-bottom:1px solid var(--bd);background:var(--pan)}
.pr .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}
.pr .mark{width:31px;height:31px;border-radius:9px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:grid;place-items:center;font-size:15px}
.pr .chip{font-size:11px;color:var(--mut);border:1px solid var(--bd2);border-radius:99px;padding:3px 10px}
.pr .btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;padding:9px 15px;transition:.15s}.pr .btn:disabled{opacity:.5;cursor:not-allowed}
.pr .pri{background:var(--acc);color:#fff}.pr .pri:hover:not(:disabled){background:#2563eb}.pr .gho{background:var(--pan2);color:var(--txt);border:1px solid var(--bd2)}.pr .red{background:#dc2626;color:#fff}
.pr .wrap{max-width:1000px;margin:0 auto;padding:18px 22px 50px}
.pr .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.pr .stat{background:var(--pan);border:1px solid var(--bd);border-radius:14px;padding:15px;position:relative;overflow:hidden}
.pr .stat .l{font-size:12px;color:var(--mut)}.pr .stat .v{font-size:24px;font-weight:800;margin-top:4px}
.pr .stat .ic{position:absolute;right:12px;top:12px;font-size:18px;opacity:.5}
.pr .tabs{display:inline-flex;gap:4px;background:var(--pan);border:1px solid var(--bd);border-radius:12px;padding:4px;margin-bottom:14px}
.pr .tab{border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:13px;padding:8px 16px;border-radius:9px;cursor:pointer}.pr .tab.on{background:var(--acc);color:#fff}
.pr .run{background:var(--pan);border:1px solid var(--bd);border-radius:14px;padding:15px;margin-bottom:10px}
.pr .card{background:var(--pan);border:1px solid var(--bd);border-radius:16px;padding:18px;max-width:460px;margin:0 auto}
.pr label{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 5px}
.pr input{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:9px;padding:10px 12px;font:inherit;font-size:14px;color:var(--txt);outline:none}.pr input:focus{border-color:var(--acc)}
.pr .menu{position:absolute;right:0;top:116%;background:var(--pan2);border:1px solid var(--bd2);border-radius:10px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.pr .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:7px;cursor:pointer}.pr .menu button:hover{background:rgba(255,255,255,.05)}
@media(max-width:860px){.pr .stats{grid-template-columns:1fr 1fr}}
`;
function Run({ id, me, busy, write }: { id: bigint; me?: string; busy: boolean; write: (fn: string, args: any[], v?: bigint) => void }) {
  const { data: r } = useReadContract({ address: C, abi: ABI, functionName: "get", args: [id] });
  const { data: cnt } = useReadContract({ address: C, abi: ABI, functionName: "count", args: [id] });
  const [rec, setRec] = useState({ to: "", amount: "" });
  if (!r) return null; const x = r as any; const mine = me?.toLowerCase() === x.owner.toLowerCase();
  return (
    <div className="run">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(59,130,246,.16)", display: "grid", placeItems: "center", fontSize: 17 }}>💼</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{x.name || `Run #${id}`}</div><div style={{ fontSize: 11, color: "var(--mut)" }} className="mono">${usd(x.totalAmt)} · {cnt?.toString() ?? "0"} recipients · {cut(x.owner)}</div></div>
        {x.paid && <span style={{ fontSize: 11, color: "var(--up)" }}>Paid ✓</span>}
      </div>
      {mine && !x.paid && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}><input value={rec.to} onChange={e => setRec(s => ({ ...s, to: e.target.value }))} placeholder="0x recipient…" style={{ flex: 1, fontFamily: "ui-monospace", fontSize: 12.5 }} /><input value={rec.amount} onChange={e => setRec(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="amt" style={{ width: 90 }} /><button className="btn gho" disabled={busy || !isAddress(rec.to) || !(Number(rec.amount) > 0)} onClick={() => write("addRecipient", [id, rec.to as `0x${string}`, parseEther(rec.amount || "0")])}>Add</button></div>
        <button className="btn pri" disabled={busy || x.totalAmt === 0n} onClick={() => write("fundAndPay", [id], x.totalAmt)}>{busy ? "…" : `Fund & pay $${usd(x.totalAmt)}`}</button>
      </div>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"runs" | "new" | "send">("runs"); const [nm, setNm] = useState("");
  const [snd, setSnd] = useState({ to: "", amount: "" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const send = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: send.data, query: { enabled: !!send.data } });
  const sbusy = send.isPending || srcpt.isLoading;
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setNm(""); total.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { send.reset(); setSnd({ to: "", amount: "" }); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const write = (fn: string, args: any[], v?: bigint) => tx.writeContract({ address: C, abi: ABI, functionName: fn as any, args, value: v });
  return (
    <div className="pr">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">💼</span>Arc Payroll</div>
        <span className="chip">Batch salary · USDC</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button className={"btn " + (wrong ? "red" : "gho")} onClick={toArc}>{wrong ? "Switch to Arc" : "⚡ Arc network"}</button>
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#f87171" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        <div className="stats">
          <div className="stat"><span className="ic">💼</span><div className="l">Payroll runs</div><div className="v">{n}</div></div>
          <div className="stat"><span className="ic">⚡</span><div className="l">Settlement</div><div className="v" style={{ color: "var(--acc2)" }}>instant</div></div>
          <div className="stat"><span className="ic">🪙</span><div className="l">Currency</div><div className="v">USDC</div></div>
          <div className="stat"><span className="ic">🔗</span><div className="l">Network</div><div className="v" style={{ color: "var(--up)" }}>Arc</div></div>
        </div>
        <div className="tabs">{([["runs", "Payruns"], ["new", "Schedule"], ["send", "Pay out"]] as const).map(([t, l]) => <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>)}</div>
        {tab === "runs" && <div>{n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <Run key={id.toString()} id={id} me={address} busy={busy} write={write} />) : <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No runs yet — create one 💼</div>}</div>}
        {tab === "new" && <div className="card">
          <label>Run name</label><input value={nm} onChange={e => setNm(e.target.value)} placeholder="e.g. October payroll" />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !nm} onClick={() => write("createRun", [nm])}>{busy ? "…" : "Create run 💼"}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", textAlign: "center", marginTop: 8 }}>Then open it under Payruns to add recipients and fund &amp; pay.</div>
        </div>}
        {tab === "send" && <div className="card" style={{ maxWidth: 440 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Pay out USDC</div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>One-off payout to any address on Arc.</div>
          <label>To address</label><input value={snd.to} onChange={e => setSnd(s => ({ ...s, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label>Amount (USDC)</label><input value={snd.amount} onChange={e => setSnd(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || sbusy || !isAddress(snd.to) || !(Number(snd.amount) > 0)} onClick={() => send.sendTransaction({ to: snd.to as `0x${string}`, value: parseEther(snd.amount || "0") })}>{sbusy ? "Sending…" : "Pay out ↗"}</button>
          {srcpt.isSuccess && <div style={{ fontSize: 12, color: "var(--up)", textAlign: "center", marginTop: 8 }}>✓ Sent</div>}
        </div>}
        <div style={{ textAlign: "center", color: "#475", fontSize: 12, marginTop: 18 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
