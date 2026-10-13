import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Send } from "lucide-react";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Send size={14} />
            </div>
            <span className="font-bold text-slate-900">Outreachly</span>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
