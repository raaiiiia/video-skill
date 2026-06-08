import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, RefreshCw, Send, ShieldCheck, UserPlus } from "lucide-react";
import { loginAccount, registerAccount, sendAuthCode, type AccountProfile } from "../lib/backend";

type AuthMode = "login" | "register";

export type { AccountProfile };

interface AuthPageProps {
  onBack: () => void;
  onAuthenticated: (profile: AccountProfile) => void;
}

const captchaChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCaptcha() {
  return Array.from({ length: 4 }, () => captchaChars[Math.floor(Math.random() * captchaChars.length)]).join("");
}

function makeCaptchaImage(value: string) {
  const letters = value.split("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="136" height="48" viewBox="0 0 136 48">
      <rect width="136" height="48" rx="6" fill="#F4FAF4"/>
      <path d="M8 35 C40 10, 84 45, 128 13" stroke="#8DB38B" stroke-width="2" opacity=".45" fill="none"/>
      ${Array.from({ length: 28 }, (_, index) => {
        const x = (index * 37) % 132;
        const y = (index * 19) % 44;
        const color = index % 3 === 0 ? "#2F7D56" : index % 3 === 1 ? "#D59A2A" : "#6A8EAE";
        return `<circle cx="${x}" cy="${y}" r="${index % 2 ? 1.1 : 1.7}" fill="${color}" opacity=".42"/>`;
      }).join("")}
      ${letters
        .map((letter, index) => {
          const x = 19 + index * 28;
          const y = 31 + ((index % 2) - 0.5) * 8;
          const rotate = [-9, 6, -5, 8][index];
          return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#2F7D56" transform="rotate(${rotate} ${x} ${y})">${letter}</text>`;
        })
        .join("")}
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthPage({ onBack, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captcha, setCaptcha] = useState(() => randomCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("登录后可保护解析额度和个人 Skill 记录。");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const captchaImage = useMemo(() => makeCaptchaImage(captcha), [captcha]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  function refreshCaptcha() {
    setCaptcha(randomCaptcha());
    setCaptchaInput("");
  }

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    const timer = window.setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          timerRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    timerRef.current = timer;
  }

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
      setMessage("请先输入有效邮箱。");
      return;
    }

    setSubmitting(true);
    try {
      const result = await sendAuthCode(normalizedEmail);
      if (result.code) setEmailCode(result.code);
      setMessage(result.message);
      startCooldown(result.cooldown_seconds);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码发送失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (website.trim()) {
      setMessage("注册失败，请刷新后重试。");
      return;
    }
    if (!validEmail(normalizedEmail)) {
      setMessage("请输入有效邮箱。");
      return;
    }
    if (password.length < 6) {
      setMessage("密码至少 6 位。");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setMessage("请输入账号名称。");
        return;
      }
      if (!emailCode.trim()) {
        setMessage("请输入邮箱验证码。");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("两次密码不一致。");
        return;
      }
      if (captchaInput.trim().toUpperCase() !== captcha) {
        setMessage("图形验证码不正确。");
        refreshCaptcha();
        return;
      }
    }

    setSubmitting(true);
    try {
      const account =
        mode === "login"
          ? await loginAccount(normalizedEmail, password)
          : await registerAccount({
              name: name.trim(),
              email: normalizedEmail,
              password,
              emailCode: emailCode.trim(),
              captcha: captchaInput.trim().toUpperCase(),
            });
      onAuthenticated(account);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "认证失败，请重试。");
      if (mode === "register") refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid h-dvh min-h-0 grid-cols-[420px_minmax(0,1fr)] overflow-hidden bg-[#F7F3EA] text-[#1F2933] max-lg:grid-cols-1">
      <section className="flex min-h-0 flex-col border-r border-black/10 bg-[#FFFCF6] px-8 py-6 max-lg:border-r-0">
        <button type="button" onClick={onBack} className="mb-8 flex w-fit items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-black/5">
          <ArrowLeft className="h-4 w-4" />
          返回工作台
        </button>

        <div className="mb-6">
          <div className="mb-5 grid grid-cols-2 rounded-md border border-black/10 bg-white p-1">
            {(["login", "register"] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setMessage(item === "login" ? "登录后可保护解析额度和个人 Skill 记录。" : "注册账号后进入个人 Skill 工作台。");
                }}
                className={`h-9 rounded text-sm font-semibold ${mode === item ? "bg-[#1F2933] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">{mode === "login" ? "登录个人账号" : "创建个人账号"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto pb-4">
          {mode === "register" && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">账号名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#2F7D56]" placeholder="例如：技能学习者" />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">邮箱</span>
            <div className="mt-1 flex gap-2 max-sm:flex-col">
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#2F7D56]" placeholder="you@example.com" />
              {mode === "register" && (
                <button type="button" onClick={sendCode} disabled={cooldown > 0 || submitting} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#D59A2A] px-3 text-sm font-semibold text-white disabled:bg-slate-300">
                  <Send className="h-4 w-4" />
                  {cooldown > 0 ? `${cooldown}s` : "发送验证码"}
                </button>
              )}
            </div>
          </label>

          {mode === "register" && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">邮箱验证码</span>
              <input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#2F7D56]" placeholder="6 位验证码" />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">密码</span>
            <div className="relative mt-1">
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} className="h-10 w-full rounded-md border border-black/10 bg-white px-3 pr-10 text-sm outline-none focus:border-[#2F7D56]" placeholder="至少 6 位" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">确认密码</span>
                <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#2F7D56]" placeholder="再次输入密码" />
              </label>

              <label className="hidden">
                主页
                <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
              </label>

              <div>
                <span className="text-xs font-semibold text-slate-600">图形验证码</span>
                <div className="mt-1 grid grid-cols-[136px_minmax(0,1fr)_40px] gap-2 max-sm:grid-cols-1">
                  <img src={captchaImage} alt="四字符图形验证码" className="h-12 w-[136px] rounded-md border border-black/10 bg-white object-cover" />
                  <input value={captchaInput} onChange={(event) => setCaptchaInput(event.target.value)} className="h-12 rounded-md border border-black/10 bg-white px-3 text-sm uppercase outline-none focus:border-[#2F7D56]" placeholder="输入图中字符" />
                  <button type="button" onClick={refreshCaptcha} aria-label="刷新验证码" className="grid h-12 w-10 place-items-center rounded-md border border-black/10 bg-white text-slate-600 hover:bg-slate-50 max-sm:w-full">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button type="button" onClick={submit} disabled={submitting} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1F2933] text-sm font-semibold text-white hover:bg-[#111827] disabled:bg-slate-400">
          {mode === "login" ? <ShieldCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {submitting ? "处理中" : mode === "login" ? "登录" : "注册并进入"}
        </button>
      </section>

      <section className="relative min-h-0 overflow-hidden bg-[#F3F0E7] p-10 max-lg:hidden">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#2F7D56]">AI Video Skill Tree</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal">把链接解析、算法技能和软件操作沉淀到个人 Skill 账号。</h2>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {["链接解析保护", "个人 Skill 库", "验证码注册"].map((item) => (
              <div key={item} className="rounded-md border border-black/10 bg-white/70 p-4">
                <p className="text-sm font-semibold">{item}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">账号维度保存记录，后续可接入服务端鉴权和额度限制。</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-10 right-10 h-[360px] w-[520px] rounded-[8px] border border-black/10 bg-white/80 p-8">
          <div className="relative h-full">
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#2F7D56]/30" />
            <div className="absolute left-[38%] top-[24%] h-24 w-24 rounded-full border border-[#D59A2A]/50" />
            <div className="absolute right-[18%] top-[48%] h-28 w-28 rounded-full border border-[#6A8EAE]/50" />
            <div className="absolute bottom-[18%] left-[18%] h-20 w-20 rounded-full border border-[#2F7D56]/50" />
            <div className="absolute left-8 right-8 top-1/2 h-px bg-[#2F7D56]/25" />
            <div className="absolute bottom-8 left-1/2 top-8 w-px bg-[#2F7D56]/25" />
            <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-[#1F2933] text-sm font-semibold text-white">Skill</div>
          </div>
        </div>
      </section>
    </main>
  );
}
