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
export async function pedirCodigo(email){
  const { error } = await (await obter()).auth.signInWithOtp({
    email, options: { shouldCreateUser: true, emailRedirectTo: location.origin },
  });
  if (error) throw error;
}

export async function confirmarCodigo(email, codigo){
  const { data, error } = await (await obter()).auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error) throw error;
  return data.user;
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
