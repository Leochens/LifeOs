// Plugin Registry - 注册所有可用插件
// 这个文件是插件系统的核心，定义了所有可用的插件及其组件

import Dashboard from "@/components/modules/dashboard/index";
import DailyView from "@/components/modules/daily/index";
import KanbanView from "@/components/modules/kanban/KanbanView";
import PlanningView from "@/components/modules/planning/PlanningView";
import DiaryView from "@/components/modules/diary/index";
import DecisionsView from "@/components/modules/decisions/index";
import LifeView from "@/components/modules/life/LifeView";
import ChatView from "@/components/modules/chat/index";
import MailView from "@/components/modules/mail/index";
import ServersView from "@/components/modules/servers/ServersView";
import ConnectorsView from "@/components/modules/connectors/index";
import StickyNotesView from "@/components/modules/sticky-notes/index";
import SkillsView from "@/components/modules/skills/index";
import GitScannerView from "@/components/modules/git-scanner/GitScannerView";
import SchedulerView from "@/components/modules/scheduler/SchedulerView";
import SettingsView from "@/components/modules/Settings/SettingsView";
import FinanceView from "@/components/modules/finance/FinanceView";
import SubscriptionsView from "@/components/modules/subscriptions/SubscriptionsView";
import NotesView from "@/components/modules/notes/index";

import type { ComponentType } from "react";

// 插件组件类型
export type PluginComponent = ComponentType<unknown>;

// 插件注册表 - 将插件 ID 映射到其组件
export const PLUGIN_REGISTRY: Record<string, PluginComponent> = {
  dashboard: Dashboard,
  daily: DailyView,
  kanban: KanbanView,
  planning: PlanningView,
  diary: DiaryView,
  decisions: DecisionsView,
  life: LifeView,
  chat: ChatView,
  mail: MailView,
  servers: ServersView,
  connectors: ConnectorsView,
  stickynotes: StickyNotesView,
  skills: SkillsView,
  gitscanner: GitScannerView,
  scheduler: SchedulerView,
  finance: FinanceView,
  subscriptions: SubscriptionsView,
  settings: SettingsView,
  notes: NotesView,
};

// 获取插件组件
export function getPluginComponent(pluginId: string): PluginComponent | null {
  return PLUGIN_REGISTRY[pluginId] || null;
}

// 检查插件是否存在
export function hasPlugin(pluginId: string): boolean {
  return pluginId in PLUGIN_REGISTRY;
}

// 获取所有已注册的插件 ID
export function getRegisteredPluginIds(): string[] {
  return Object.keys(PLUGIN_REGISTRY);
}
