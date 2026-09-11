/* =========================================================================
   TERMINALIS — Schema SQL para Supabase
   =========================================================================
   Cria tabelas e políticas de Row Level Security para sincronização em nuvem.
   Execute este script no SQL Editor do Supabase após criar o projeto.
   ========================================================================= */

-- 1. Tabela de perfis de usuário (extensão de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT UNIQUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida por email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Tabela de progresso (aulas concluídas, notas, preferências)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dados de progresso (JSON)
  lessons JSONB DEFAULT '{}',
  tasks JSONB DEFAULT '{}',
  notes JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',

  -- Auditoria
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_dispositivo TEXT
);

-- Índice para acesso rápido por user_id
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_user_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_progress_update_timestamp ON public.user_progress;
CREATE TRIGGER user_progress_update_timestamp
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_user_progress_timestamp();

-- 3. Tabela de snapshots do workspace (ambiente do laboratório)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Versão do schema (para migração futura)
  version INTEGER DEFAULT 1,

  -- Estado completo do workspace (VFS, Git, Docker, Shell)
  snapshot JSONB NOT NULL,

  -- Controle de revisão para evitar conflitos entre dispositivos
  revision INTEGER DEFAULT 1,
  baseRevision INTEGER DEFAULT 0,

  -- Qual dispositivo salvou por último
  device TEXT,

  -- Auditoria
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acesso rápido por user_id (um workspace por usuário)
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.workspaces(user_id);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_workspaces_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspaces_update_timestamp ON public.workspaces;
CREATE TRIGGER workspaces_update_timestamp
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspaces_timestamp();

-- =========================================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =========================================================================
-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- PROFILES: usuários só veem seu próprio perfil
DROP POLICY IF EXISTS "Usuários veem seu perfil" ON public.profiles;
CREATE POLICY "Usuários veem seu perfil"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Usuários atualizam seu perfil" ON public.profiles;
CREATE POLICY "Usuários atualizam seu perfil"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Usuários criam seu perfil" ON public.profiles;
CREATE POLICY "Usuários criam seu perfil"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- USER_PROGRESS: usuários só acessam seu próprio progresso
DROP POLICY IF EXISTS "Usuários veem seu progresso" ON public.user_progress;
CREATE POLICY "Usuários veem seu progresso"
  ON public.user_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários atualizam seu progresso" ON public.user_progress;
CREATE POLICY "Usuários atualizam seu progresso"
  ON public.user_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários criam seu progresso" ON public.user_progress;
CREATE POLICY "Usuários criam seu progresso"
  ON public.user_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- WORKSPACES: usuários só acessam seu próprio workspace
DROP POLICY IF EXISTS "Usuários veem seu workspace" ON public.workspaces;
CREATE POLICY "Usuários veem seu workspace"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários atualizam seu workspace" ON public.workspaces;
CREATE POLICY "Usuários atualizam seu workspace"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários criam seu workspace" ON public.workspaces;
CREATE POLICY "Usuários criam seu workspace"
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- FUNCTIONS AUXILIARES (opcional, para performance e segurança)
-- =========================================================================

-- Função para obter ou criar workspace do usuário
CREATE OR REPLACE FUNCTION get_or_create_workspace(user_id UUID)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  snapshot JSONB,
  revision INTEGER,
  baseRevision INTEGER,
  device TEXT,
  criado_em TIMESTAMP WITH TIME ZONE,
  atualizado_em TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, w.version, w.snapshot, w.revision, w.baseRevision, w.device, w.criado_em, w.atualizado_em
  FROM public.workspaces w
  WHERE w.user_id = user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para salvar workspace com revisão (impede conflitos)
CREATE OR REPLACE FUNCTION save_workspace_with_revision(
  user_id UUID,
  p_version INTEGER,
  p_snapshot JSONB,
  p_baseRevision INTEGER,
  p_device TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  conflito BOOLEAN,
  revision INTEGER,
  atual JSONB
) AS $$
DECLARE
  v_current_revision INTEGER;
  v_new_revision INTEGER;
  v_current JSONB;
BEGIN
  -- Obtém revisão atual
  SELECT w.revision, w.snapshot INTO v_current_revision, v_current
  FROM public.workspaces w
  WHERE w.user_id = save_workspace_with_revision.user_id;

  -- Se não existe, cria novo
  IF v_current_revision IS NULL THEN
    INSERT INTO public.workspaces (user_id, version, snapshot, revision, baseRevision, device)
    VALUES (user_id, p_version, p_snapshot, 1, 0, p_device);
    RETURN QUERY SELECT true, false, 1::INTEGER, p_snapshot;
    RETURN;
  END IF;

  -- Verifica conflito: baseRevision deve corresponder à revisão atual
  IF p_baseRevision != v_current_revision THEN
    -- Conflito! Retorna estado atual sem sobrescrever
    RETURN QUERY SELECT false, true, v_current_revision, v_current;
    RETURN;
  END IF;

  -- Sem conflito: atualiza com nova revisão
  v_new_revision := v_current_revision + 1;
  UPDATE public.workspaces
  SET version = p_version,
      snapshot = p_snapshot,
      revision = v_new_revision,
      baseRevision = p_baseRevision,
      device = p_device
  WHERE user_id = save_workspace_with_revision.user_id;

  RETURN QUERY SELECT true, false, v_new_revision, p_snapshot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- DADOS INICIAIS (OPCIONAL)
-- =========================================================================
-- Se quiser criar usuários de teste para desenvolvimento, descomente:
/*
INSERT INTO auth.users (email, email_confirmed_at, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, role)
VALUES (
  'teste@exemplo.com',
  CURRENT_TIMESTAMP,
  crypt('senha123', gen_salt('bf')),  -- Supabase faz isto automaticamente
  '{"provider":"email","providers":["email"]}',
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL,
  'authenticated'
) ON CONFLICT DO NOTHING;
*/

-- =========================================================================
-- VERIFICAÇÃO FINAL
-- =========================================================================
-- Listar todas as políticas criadas:
-- SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'user_progress', 'workspaces');

-- Listar tamanho das tabelas:
-- SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
-- FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'user_progress', 'workspaces');
