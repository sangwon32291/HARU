import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { listDemoAccounts } from '@/services/auth';
import { useToast } from '@/components/ui/toast';
import { Button, Field, Input } from '@/components/ui';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-haru-primary text-lg font-black text-white">
          H
        </span>
        <h1 className="text-[22px] font-black">{title}</h1>
        <p className="mt-1 text-sm text-haru-sub">{subtitle}</p>
      </div>
      <div className="haru-card p-4">{children}</div>
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const redirect = params.get('redirect') ?? '/';
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const demoAccounts = listDemoAccounts();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    toast(`${res.data.nickname}님, 환영합니다.`, 'success');
    navigate(redirect, { replace: true });
  };

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('haru1234');
  };

  return (
    <AuthShell title="로그인" subtitle="하나의 계정으로 구직과 구인을 모두 이용할 수 있습니다">
      <form onSubmit={submit} className="space-y-4">
        <Field label="이메일" required htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="haru@example.com"
            required
          />
        </Field>
        <Field label="비밀번호" required error={error} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
          />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={loading}>
          로그인
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-haru-sub">
        아직 계정이 없으신가요?{' '}
        <Link to="/signup" className="font-semibold text-haru-primary">
          회원가입
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-haru-border bg-haru-bg p-4">
        <p className="text-xs font-bold text-haru-text">데모 계정 (비밀번호: haru1234)</p>
        <p className="mt-1 text-xs leading-relaxed text-haru-sub">
          샘플 데이터 확인용입니다. 아래를 누르면 입력란이 자동으로 채워집니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['employer1@haru.test', 'worker1@haru.test', 'admin@haru.test'].map((mail) => {
            const account = demoAccounts.find((a) => a.email === mail);
            return (
              <button
                key={mail}
                type="button"
                onClick={() => quickLogin(mail)}
                className="rounded-lg border border-haru-border bg-white px-2.5 py-1.5 text-xs font-semibold text-haru-text hover:border-haru-primary"
              >
                {account?.role ?? ''} · {mail}
              </button>
            );
          })}
        </div>
      </div>
    </AuthShell>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ email: '', password: '', nickname: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signUp(form);
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    toast('가입이 완료되었습니다.', 'success');
    navigate('/', { replace: true });
  };

  return (
    <AuthShell title="회원가입" subtitle="일자리를 찾고, 등록하고, 후기를 남겨보세요">
      <form onSubmit={submit} className="space-y-4">
        <Field label="이메일" required htmlFor="signup-email">
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="비밀번호" required hint="8자 이상" htmlFor="signup-password">
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        <Field label="닉네임" required hint="2~12자. 공고와 후기에 표시됩니다." htmlFor="nickname">
          <Input
            id="nickname"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            required
          />
        </Field>
        <Field label="연락처" hint="선택 입력. 다른 사용자에게 공개되지 않습니다." error={error} htmlFor="phone">
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="010-0000-0000"
          />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={loading}>
          가입하기
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-haru-sub">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="font-semibold text-haru-primary">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
