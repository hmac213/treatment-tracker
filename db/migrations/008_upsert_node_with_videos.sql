create or replace function upsert_node_with_videos(p_node_id uuid, p_title text, p_summary text, p_videos jsonb)
returns void as $$
begin
  -- Update the node itself
  update public.nodes
  set
    title = p_title,
    summary = p_summary,
    updated_at = now()
  where id = p_node_id;

  -- Remove existing videos for this node
  delete from public.node_videos where node_id = p_node_id;

  -- Insert new videos if any are provided
  if jsonb_array_length(p_videos) > 0 then
    insert into public.node_videos (node_id, title, video_url, order_index)
    select
      p_node_id,
      v.title,
      v.video_url,
      v.order_index
    from jsonb_to_recordset(p_videos) as v(title text, video_url text, order_index int);
  end if;
end;
$$ language plpgsql;

