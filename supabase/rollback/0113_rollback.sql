-- Rollback da 0113 (guias fora do ar). Volte o app para uma versão anterior ao
-- PR da 0113 antes. Os guias escondidos voltam a aparecer.
drop function if exists public.set_blog_post_hidden(text, boolean, text);
drop function if exists public.list_blog_hidden_posts();
drop table if exists public.blog_hidden_posts;
