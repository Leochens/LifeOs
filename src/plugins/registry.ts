// Plugin Registry - 注册所有可用插件
// 这个文件是插件系统的核心，定义了所有可用的插件及其组件

import Dashboard from "@/components/modules/Dashboard";
import DailyView from "@/components/modules/DailyView";
import KanbanView from "@/components/modules/kanban/KanbanView";
import PlanningView from "@/components/modules/PlanningView";
import DiaryView from "@/components/modules/DiaryView";
import DecisionsView from "@/components/modules/DecisionsView";
import LifeView from "@/components/modules/LifeView";
import ChatView from "@/components/modules/ChatView";
import MailView from "@/components/modules/MailView";
import ServersView from "@/components/modules/ServersView";
import ConnectorsView from "@/components/modules/ConnectorsView";
import StickyNotesView from "@/components/modules/StickyNotesView";
import SkillsView from "@/components/modules/SkillsView";
import GitScannerView from "@/components/modules/GitScannerView";
import SchedulerView from "@/components/modules/SchedulerView";
import SettingsView from "@/components/modules/SettingsView";
import FinanceView from "@/components/modules/finance/FinanceView";
import SubscriptionsView from "@/components/modules/subscriptions/SubscriptionsView";
import NotesView from "@/components/modules/NotesView";

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
