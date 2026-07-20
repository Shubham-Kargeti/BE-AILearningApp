type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private storageKey = "app_logs";

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs.slice(-this.maxLogs)));
    } catch {
      // storage full or unavailable
    }
  }

  log(level: LogLevel, component: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.saveLogs();

    const prefix = `[${entry.timestamp}] [${level}] [${component}]`;
    switch (level) {
      case "ERROR":
        console.error(prefix, message, data ?? "");
        break;
      case "WARN":
        console.warn(prefix, message, data ?? "");
        break;
      default:
        console.log(prefix, message, data ?? "");
    }
  }

  info(component: string, message: string, data?: unknown) {
    this.log("INFO", component, message, data);
  }

  warn(component: string, message: string, data?: unknown) {
    this.log("WARN", component, message, data);
  }

  error(component: string, message: string, data?: unknown) {
    this.log("ERROR", component, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  exportLogs(): string {
    return this.logs
      .map((entry) => {
        const line = `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.message}`;
        if (entry.data !== undefined) {
          return `${line} | data=${JSON.stringify(entry.data)}`;
        }
        return line;
      })
      .join("\n");
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem(this.storageKey);
  }
}

export const logger = new Logger();
