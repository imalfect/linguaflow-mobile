import { supabase } from "./supabase";
import type { ModuleBlueprint, ModuleTask } from "@linguaflow/shared";

export interface ModuleRow {
  id: string;
  user_id: string;
  language_code: string;
  level: string;
  topic: string;
  title: string;
  description: string;
  emoji: string;
  status: "active" | "completed" | "abandoned";
  current_task_index: number;
  created_at: string;
  completed_at: string | null;
}

export interface ModuleTaskRow {
  id: string;
  module_id: string;
  task_index: number;
  kind: "vocabulary" | "phrase" | "free_speech";
  title: string;
  prompt: string;
  target_sentence: string;
  translation: string;
  ipa: string | null;
  reading: string | null;
  vocabulary: Array<{ term: string; translation: string; ipa?: string }> | null;
  completed: boolean;
  best_accuracy: number | null;
  attempts: number;
  completed_at: string | null;
}

export async function loadActiveModule(userId: string): Promise<ModuleRow | null> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("loadActiveModule", error);
    return null;
  }
  return data as ModuleRow | null;
}

export async function loadModule(moduleId: string): Promise<ModuleRow | null> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  if (error) {
    console.error("loadModule", error);
    return null;
  }
  return data as ModuleRow | null;
}

export async function loadModuleTasks(moduleId: string): Promise<ModuleTaskRow[]> {
  const { data, error } = await supabase
    .from("module_tasks")
    .select("*")
    .eq("module_id", moduleId)
    .order("task_index");
  if (error) {
    console.error("loadModuleTasks", error);
    return [];
  }
  return (data ?? []) as ModuleTaskRow[];
}

export async function createModuleFromBlueprint(opts: {
  userId: string;
  languageCode: string;
  level: string;
  topic: string;
  blueprint: ModuleBlueprint;
}): Promise<string | null> {
  const { data: moduleRow, error: moduleErr } = await supabase
    .from("modules")
    .insert({
      user_id: opts.userId,
      language_code: opts.languageCode,
      level: opts.level,
      topic: opts.topic,
      title: opts.blueprint.title,
      description: opts.blueprint.description,
      emoji: opts.blueprint.emoji,
    })
    .select("id")
    .single();
  if (moduleErr || !moduleRow) {
    console.error("createModule", moduleErr);
    return null;
  }
  const moduleId = moduleRow.id as string;

  const rows = opts.blueprint.tasks.map((task: ModuleTask) => ({
    module_id: moduleId,
    task_index: task.index,
    kind: task.kind,
    title: task.title,
    prompt: task.prompt,
    target_sentence: task.targetSentence,
    translation: task.translation,
    ipa: task.ipa ?? null,
    reading: task.reading ?? null,
    vocabulary: task.vocabulary ?? null,
  }));
  const { error: tasksErr } = await supabase.from("module_tasks").insert(rows);
  if (tasksErr) {
    console.error("createModuleTasks", tasksErr);
    // best effort: leave module row, no rollback
  }
  return moduleId;
}

export async function markTaskCompleted(
  taskRowId: string,
  bestAccuracy: number,
  moduleId: string,
  taskIndex: number,
): Promise<void> {
  await supabase
    .from("module_tasks")
    .update({
      completed: true,
      best_accuracy: bestAccuracy,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskRowId);
  await supabase
    .from("modules")
    .update({ current_task_index: Math.min(9, taskIndex + 1) })
    .eq("id", moduleId);
}

export async function incrementAttempts(taskRowId: string, bestAccuracySoFar: number, latest: number) {
  await supabase
    .from("module_tasks")
    .update({
      attempts: undefined, // placeholder; we'll use RPC if needed
      best_accuracy: Math.max(bestAccuracySoFar ?? 0, latest),
    })
    .eq("id", taskRowId);
}

export async function completeModule(moduleId: string): Promise<void> {
  await supabase
    .from("modules")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", moduleId);
}

export async function abandonModule(moduleId: string): Promise<void> {
  await supabase.from("modules").update({ status: "abandoned" }).eq("id", moduleId);
}

export async function recentTopics(userId: string, limit = 5): Promise<string[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("topic")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => (r as { topic: string }).topic);
}
