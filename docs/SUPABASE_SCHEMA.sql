/* =========================================================================
   TERMINALIS — schema Supabase para autenticação e sincronização
   =========================================================================
   O cliente usa estes nomes diretamente:
     profiles:      id, username, name
     user_progress: user_id, data, updated_at
     workspaces:    user_id, snapshot_version, data, revision, updated_at, device

   Execute este arquivo em um projeto Supabase novo ou existente. O bloco de
   migração converte a nomenclatura da primeira versão sem apagar os dados.
   A autorização vem das políticas RLS; o navegador nunca envia um user_id
   para decidir de quem são os dados.
   ========================================================================= */

-- Estrutura canônica
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device TEXT
);

-- Migração da nomenclatura da primeira versão
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nome')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name') THEN
    ALTER TABLE public.profiles RENAME COLUMN nome TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'criado_em')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE public.profiles RENAME COLUMN criado_em TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'atualizado_em')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles RENAME COLUMN atualizado_em TO updated_at;
  END IF;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'data') THEN
    ALTER TABLE public.user_progress ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'lessons') THEN
      UPDATE public.user_progress
      SET data = jsonb_build_object(
        'lessons', COALESCE(lessons, '{}'::jsonb),
        'tasks', COALESCE(tasks, '{}'::jsonb),
        'notes', COALESCE(notes, '{}'::jsonb),
        'settings', COALESCE(settings, '{}'::jsonb)
      );
      ALTER TABLE public.user_progress DROP COLUMN IF EXISTS lessons;
      ALTER TABLE public.user_progress DROP COLUMN IF EXISTS tasks;
      ALTER TABLE public.user_progress DROP COLUMN IF EXISTS notes;
      ALTER TABLE public.user_progress DROP COLUMN IF EXISTS settings;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'atualizado_em')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_progress' AND column_name = 'updated_at') THEN
    ALTER TABLE public.user_progress RENAME COLUMN atualizado_em TO updated_at;
  END IF;
  ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'version')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'snapshot_version') THEN
    ALTER TABLE public.workspaces RENAME COLUMN version TO snapshot_version;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'snapshot')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'data') THEN
    ALTER TABLE public.workspaces RENAME COLUMN snapshot TO data;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'atualizado_em')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'updated_at') THEN
    ALTER TABLE public.workspaces RENAME COLUMN atualizado_em TO updated_at;
  END IF;
  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS snapshot_version INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS data JSONB;
  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS device TEXT;
  UPDATE public.workspaces SET data = '{}'::jsonb WHERE data IS NULL;
  ALTER TABLE public.workspaces ALTER COLUMN data SET NOT NULL;
  UPDATE public.workspaces SET snapshot_version = 1 WHERE snapshot_version IS NULL;
  ALTER TABLE public.workspaces ALTER COLUMN snapshot_version SET DEFAULT 1;
  ALTER TABLE public.workspaces ALTER COLUMN snapshot_version SET NOT NULL;
  UPDATE public.workspaces SET revision = 1 WHERE revision IS NULL OR revision < 1;
  ALTER TABLE public.workspaces ALTER COLUMN revision SET DEFAULT 1;
  ALTER TABLE public.workspaces ALTER COLUMN revision SET NOT NULL;
  ALTER TABLE public.workspaces DROP COLUMN IF EXISTS baserevision;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_progress_user_id_key ON public.user_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_user_id_key ON public.workspaces(user_id);

-- Timestamps e perfil criado pelo evento de autenticação
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS user_progress_updated_at ON public.user_progress;
CREATE TRIGGER user_progress_updated_at BEFORE UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

/* Esta é a única função SECURITY DEFINER: o trigger precisa criar o perfil
   durante auth.signUp, antes de existir uma sessão authenticated. Ela não
   recebe user_id do cliente, fixa search_path e só usa NEW.id do auth.users. */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, email)
  VALUES (
    NEW.id,
    NULLIF(LOWER(LEFT(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)), 24)), ''),
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS: cada linha só pertence ao auth.uid() da sessão
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS user_progress_select_own ON public.user_progress;
CREATE POLICY user_progress_select_own ON public.user_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_progress_insert_own ON public.user_progress;
CREATE POLICY user_progress_insert_own ON public.user_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_progress_update_own ON public.user_progress;
CREATE POLICY user_progress_update_own ON public.user_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_progress_delete_own ON public.user_progress;
CREATE POLICY user_progress_delete_own ON public.user_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS workspaces_select_own ON public.workspaces;
CREATE POLICY workspaces_select_own ON public.workspaces FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS workspaces_insert_own ON public.workspaces;
CREATE POLICY workspaces_insert_own ON public.workspaces FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS workspaces_update_own ON public.workspaces;
CREATE POLICY workspaces_update_own ON public.workspaces FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS workspaces_delete_own ON public.workspaces;
CREATE POLICY workspaces_delete_own ON public.workspaces FOR DELETE TO authenticated USING (user_id = auth.uid());

