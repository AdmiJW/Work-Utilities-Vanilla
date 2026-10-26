import {
  createElement,
  CodeXml,
  TableProperties,
  Command,
  Wrench,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Download,
  History,
  Plus,
  ArrowUpRight,
  Settings,
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
} from 'lucide';

const icons = {
  code: CodeXml,
  table: TableProperties,
  command: Command,
  wrench: Wrench,
  library: FolderOpen,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,
  moon: Moon,
  sun: Sun,
  download: Download,
  history: History,
  plus: Plus,
  arrow: ArrowUpRight,
  settings: Settings,
  braces: Braces,
  down: ChevronDown,
  right: ChevronRight,
  copy: Copy,
  close: X,
};

export function icon(name, size = 16) {
  return createElement(icons[name] ?? icons.code, {
    width: size,
    height: size,
    class: 'icon',
    'aria-hidden': 'true',
  });
}
