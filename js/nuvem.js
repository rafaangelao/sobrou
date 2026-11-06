import { SUPABASE_URL, SUPABASE_CHAVE } from "./config.js";

/* supabase-js só é baixado quando precisa: sem internet o painel abre igual */
let cliente = null;
async function obter(){
  if (!cliente){
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.0");
    cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  }
  return cliente;
}

export async function usuarioAtual(){
  const { data } = await (await obter()).auth.getSession();
  return data.session?.user || null;
}

/* manda o e-mail de entrada (link; se o modelo do e-mail tiver {{ .Token }}, também traz código) */
export async function pedirCodigo(email, voltaPara = location.origin){
  const { error } = await (await obter()).auth.signInWithOtp({
    email, options: { shouldCreateUser: true, emailRedirectTo: voltaPara },
  });
  if (error) throw error;
}

export async function confirmarCodigo(email, codigo){
  const { data, error } = await (await obter()).auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error) throw error;
  return data.user;
}

/* Safari: entrega a sessão que acabou de chegar pelo link para o app que pediu,
   e esquece ela aqui (sem avisar o servidor, senão a sessão do app cairia junto) */
export async function entregarSessao(codigo){
  const c = await obter();
  const { data } = await c.auth.getSession();
  const s = data.session;
  if (!s) throw new Error("sem sessão");
  const { error } = await c.rpc("entregar_sessao", { p_codigo: codigo, p_access: s.access_token, p_refresh: s.refresh_token });
  if (error) throw error;
  await c.auth.stopAutoRefresh();
  const chave = c.auth.storageKey || "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
  localStorage.removeItem(chave);
  localStorage.removeItem(chave + "-user");
}

/* app: pergunta se o Safari já entregou a sessão; se sim, entra com ela */
export async function buscarSessao(codigo){
  const c = await obter();
  const { data, error } = await c.rpc("buscar_sessao", { p_codigo: codigo });
  if (error) throw error;
  if (!data?.access_token) return null;
  const r = await c.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (r.error) throw r.error;
  return r.data.user;
}

export async function sair(){ await (await obter()).auth.signOut(); }

export async function aoMudarSessao(cb){
  (await obter()).auth.onAuthStateChange((_ev, sessao) => cb(sessao?.user || null));
}

export function apiDoCaderno(userId){
  return {
    async ler(){
      const { data, error } = await (await obter()).from("cadernos").select("dados, versao").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async inserir(dados){
      const { error } = await (await obter()).from("cadernos").insert({ user_id: userId, dados, versao: 1 });
      if (error){ if (error.code === "23505") return false; throw error; }
      return true;
    },
    async atualizar(dados, versaoLida){
      const { data, error } = await (await obter()).from("cadernos")
        .update({ dados, versao: versaoLida + 1, atualizado_em: new Date().toISOString() })
        .eq("user_id", userId).eq("versao", versaoLida).select("versao");
      if (error) throw error;
      return data.length === 1;
    },
  };
}
