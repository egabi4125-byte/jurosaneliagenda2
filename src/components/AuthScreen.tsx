import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  createSelfClientProfile,
  ensureStudioConfigExists,
} from '../lib/firestoreService';
import { formatPhoneMask } from '../lib/formatters';
import {
  ADMIN_INTERNAL_EMAIL,
  ADMIN_USERNAME,
  PASSWORD_RESET_REDIRECT_URL,
  STUDIO_HERO_IMAGE,
} from '../types';
import { BrandLogo } from './BrandLogo';

interface AuthScreenProps {
  onAdminAuthenticated: () => void;
  onClientAuthenticated: (user: User) => void;
}

type ClientAuthTab = 'login' | 'signup' | 'reset';

function mapFirebaseAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos. Confira seus dados e tente novamente.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Informe um endereço de e-mail válido.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns instantes antes de tentar novamente.';
    case 'auth/popup-closed-by-user':
      return 'Janela de login fechada antes da conclusão.';
    case 'auth/operation-not-allowed':
      return 'O método E-mail/Senha ainda precisa ser ativado no Firebase Console (Authentication → Sign-in method → E-mail/senha). Você também pode entrar imediatamente com Google abaixo.';
    default:
      return 'Não foi possível concluir a autenticação. Tente novamente.';
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAdminAuthenticated,
  onClientAuthenticated,
}) => {
  const [mode, setMode] = useState<'client' | 'admin'>('client');
  const [clientTab, setClientTab] = useState<ClientAuthTab>('login');
  const [heroImgError, setHeroImgError] = useState(false);

  // Client fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);

  const [resetEmail, setResetEmail] = useState('');

  // Admin fields
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const clearFeedback = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const isAdminIdentifierAttempt = (identifier: string) => {
    const normalized = identifier.trim().toLowerCase();
    return (
      normalized === ADMIN_USERNAME.toLowerCase() ||
      normalized === ADMIN_INTERNAL_EMAIL.toLowerCase()
    );
  };

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (isAdminIdentifierAttempt(loginEmail)) {
      setErrorMsg(
        'As credenciais da proprietária não podem ser usadas na área de clientes. Clique em "Entrar como Administrador" abaixo.'
      );
      return;
    }

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Preencha seu e-mail e sua senha para entrar.');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        loginEmail.trim(),
        loginPassword
      );
      onClientAuthenticated(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleClientSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (isAdminIdentifierAttempt(signupEmail)) {
      setErrorMsg(
        'Este identificador é reservado à administração. Utilize o acesso administrativo.'
      );
      return;
    }

    const cleanName = signupName.trim();
    const phoneDigits = signupPhone.replace(/\D/g, '');
    const cleanEmail = signupEmail.trim().toLowerCase();

    if (cleanName.length < 3) {
      setErrorMsg('Informe seu nome completo.');
      return;
    }
    if (phoneDigits.length < 10) {
      setErrorMsg('Informe seu telefone/WhatsApp com DDD (mínimo 10 dígitos).');
      return;
    }
    if (!cleanEmail.includes('@')) {
      setErrorMsg('Informe um e-mail válido.');
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        signupPassword
      );
      await updateProfile(cred.user, { displayName: cleanName });

      await createSelfClientProfile({
        uid: cred.user.uid,
        name: cleanName,
        phone: signupPhone.trim(),
        email: cleanEmail,
      });

      try {
        await sendEmailVerification(cred.user, {
          url: PASSWORD_RESET_REDIRECT_URL,
          handleCodeInApp: false,
        });
      } catch (verifyErr) {
        console.warn('Email verification notice:', verifyErr);
      }

      onClientAuthenticated(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    const cleanEmail = resetEmail.trim().toLowerCase();

    if (isAdminIdentifierAttempt(cleanEmail)) {
      setErrorMsg(
        'A recuperação de senha por e-mail é exclusiva para contas de clientes.'
      );
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Informe o e-mail cadastrado para receber o link de redefinição.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: PASSWORD_RESET_REDIRECT_URL,
        handleCodeInApp: false,
      });
      setSuccessMsg(
        `Enviamos um link de redefinição de senha para ${cleanEmail}. Confira sua caixa de entrada e spam.`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClientLogin = async () => {
    clearFeedback();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createSelfClientProfile({
        uid: result.user.uid,
        name: result.user.displayName || 'Cliente',
        phone: '(00) 00000-0000',
        email: result.user.email || '',
      });
      onClientAuthenticated(result.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (adminUser.trim() !== ADMIN_USERNAME || adminPass !== 'jurosaneli12') {
      setErrorMsg(
        'Usuário ou senha administrativos inválidos. Verifique as credenciais da proprietária.'
      );
      return;
    }

    setLoading(true);
    try {
      // Ensure no active client Firebase Auth session interferes with owner panel
      if (auth.currentUser) {
        await signOut(auth).catch(() => {});
      }
      await ensureStudioConfigExists().catch(() => {});
      onAdminAuthenticated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] grid grid-cols-1 lg:grid-cols-2 items-stretch">
      {/* Left Column: Studio Hero Photography with Measured Scrim */}
      <div className="relative min-h-[340px] lg:min-h-screen overflow-hidden bg-[#16141C] flex flex-col justify-between p-8 sm:p-12 lg:p-14">
        {!heroImgError ? (
          <img
            src={STUDIO_HERO_IMAGE}
            alt="Ambiente do estúdio Ju Nail Designer"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2B1520] via-[#16141C] to-[#3B1B2B]" />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-t from-[#16141C]/90 via-[#16141C]/45 to-[#16141C]/35"
          aria-hidden="true"
        />

        {/* Top Brand Identity */}
        <div className="relative z-10 flex items-center gap-3.5">
          <BrandLogo size="md" className="ring-white/40" />
          <div>
            <p className="font-serif text-2xl font-semibold text-white leading-none tracking-tight">
              Ju Nail Designer
            </p>
            <p className="text-xs text-white/80 mt-1 tracking-wide">
              Banho de Gel · Esmaltação
            </p>
          </div>
        </div>

        {/* Bottom Editorial Statement */}
        <div className="relative z-10 max-w-lg pt-12 lg:pt-0">
          <h1
            className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-white leading-[1.08] tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            Agenda exclusiva de nail design.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-white/80 leading-relaxed max-w-md">
            Reserve seu horário em tempo real, acompanhe seus agendamentos e
            realize pagamentos via Pix com praticidade e segurança.
          </p>
          <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/75">
            <span>Banho de Gel Natural</span>
            <span aria-hidden="true">·</span>
            <span>Esmaltação em Gel</span>
            <span aria-hidden="true">·</span>
            <span>Spa dos Pés</span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex flex-col items-center justify-center px-6 py-10 sm:px-10 lg:px-14 bg-[#FAFAFA]">
        <div className="w-full max-w-md">
          <div className="bg-white border border-[#E4E2E8] rounded-2xl p-6 sm:p-8">
            {mode === 'client' ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h2 className="font-serif text-3xl font-semibold text-[#16141C]">
                      {clientTab === 'login' && 'Área da Cliente'}
                      {clientTab === 'signup' && 'Criar conta'}
                      {clientTab === 'reset' && 'Recuperar senha'}
                    </h2>
                  </div>
                  <p className="text-sm text-[#5E5B66]">
                    {clientTab === 'login' &&
                      'Entre para agendar e acompanhar seus horários.'}
                    {clientTab === 'signup' &&
                      'Cadastre-se em segundos para reservar seu atendimento.'}
                    {clientTab === 'reset' &&
                      'Informe seu e-mail cadastrado para receber o link de redefinição.'}
                  </p>
                </div>

                {/* Segmented Tabs: Entrar / Cadastrar-se */}
                {clientTab !== 'reset' && (
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#FAFAFA] border border-[#E4E2E8] mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setClientTab('login');
                        clearFeedback();
                      }}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        clientTab === 'login'
                          ? 'bg-white text-[#16141C] shadow-xs border border-[#E4E2E8]'
                          : 'text-[#5E5B66] hover:text-[#16141C]'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClientTab('signup');
                        clearFeedback();
                      }}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        clientTab === 'signup'
                          ? 'bg-white text-[#16141C] shadow-xs border border-[#E4E2E8]'
                          : 'text-[#5E5B66] hover:text-[#16141C]'
                      }`}
                    >
                      Cadastrar-se
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-800 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* TAB: LOGIN */}
                {clientTab === 'login' && (
                  <form onSubmit={handleClientLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1.5">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="seuemail@exemplo.com"
                          autoComplete="email"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C] placeholder:text-[#5E5B66]/60 transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-[#16141C]">
                          Senha
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setClientTab('reset');
                            setResetEmail(
                              loginEmail.includes('@') ? loginEmail : ''
                            );
                            clearFeedback();
                          }}
                          className="text-xs font-medium text-[#7A2E4D] hover:text-[#61233C] transition-colors cursor-pointer"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showLoginPass ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Sua senha"
                          autoComplete="current-password"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C] placeholder:text-[#5E5B66]/60 transition-colors"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPass((v) => !v)}
                          aria-label="Mostrar senha"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
                        >
                          {showLoginPass ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {loading ? 'Entrando...' : 'Entrar na minha conta'}
                    </button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#E4E2E8]" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-3 text-[#5E5B66]">ou</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleGoogleClientLogin}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-sm font-medium text-[#16141C] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continuar com Google
                    </button>
                  </form>
                )}

                {/* TAB: SIGNUP */}
                {clientTab === 'signup' && (
                  <form onSubmit={handleClientSignup} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1">
                        Nome completo
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="Ex: Mariana Oliveira"
                          maxLength={120}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1">
                        Telefone / WhatsApp com DDD
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={signupPhone}
                          onChange={(e) =>
                            setSignupPhone(formatPhoneMask(e.target.value))
                          }
                          placeholder="(11) 99999-9999"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm text-[#16141C]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="seuemail@exemplo.com"
                          maxLength={160}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1">
                        Senha (mínimo 6 caracteres)
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showSignupPass ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="Crie uma senha segura"
                          minLength={6}
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPass((v) => !v)}
                          aria-label="Mostrar senha"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
                        >
                          {showSignupPass ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {loading ? 'Criando cadastro...' : 'Criar conta e agendar'}
                    </button>

                    <p className="text-[11px] text-[#5E5B66] text-center leading-relaxed">
                      Enviaremos automaticamente um e-mail de verificação para
                      proteger sua conta e seus horários.
                    </p>
                  </form>
                )}

                {/* TAB: RESET PASSWORD */}
                {clientTab === 'reset' && (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#16141C] mb-1.5">
                        E-mail cadastrado
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="seuemail@exemplo.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {loading
                        ? 'Enviando link...'
                        : 'Enviar link de recuperação'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setClientTab('login');
                        clearFeedback();
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar para o login
                    </button>
                  </form>
                )}

                {/* Separated Administrative Access Switch */}
                <div className="mt-6 pt-5 border-t border-[#E4E2E8] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('admin');
                      clearFeedback();
                    }}
                    className="inline-flex items-center gap-2 text-xs font-medium text-[#5E5B66] hover:text-[#7A2E4D] transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Entrar como Administrador
                  </button>
                </div>
              </>
            ) : (
              /* ADMIN ACCESS CARD */
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#F7EFF2] text-[#7A2E4D] flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-[#16141C] leading-tight">
                      Acesso da Proprietária
                    </h2>
                    <p className="text-xs text-[#5E5B66]">
                      Painel administrativo exclusivo Ju Nail Designer
                    </p>
                  </div>
                </div>

                {errorMsg && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-800 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#16141C] mb-1.5">
                      Usuário administrativo
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                        placeholder="Usuário da proprietária"
                        autoComplete="username"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#16141C] mb-1.5">
                      Senha administrativa
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showAdminPass ? 'text' : 'password'}
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="Senha de acesso"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass((v) => !v)}
                        aria-label="Mostrar senha"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
                      >
                        {showAdminPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    {loading
                      ? 'Validando acesso...'
                      : 'Entrar no Painel da Proprietária'}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-[#E4E2E8] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('client');
                      clearFeedback();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E5B66] hover:text-[#16141C] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para Área da Cliente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
