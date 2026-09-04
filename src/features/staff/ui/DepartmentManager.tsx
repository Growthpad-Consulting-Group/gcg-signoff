"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import Slideover from "@/shared/ui/Slideover";
import Button from "@/shared/ui/Button";

interface Department {
  id: string;
  name: string;
}

export default function DepartmentManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch {
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadDepartments();
  }, [isOpen]);

  const addDepartment = async () => {
    if (!newName.trim()) {
      toast.error("Department name is required");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to add department");
        return;
      }

      const data = await res.json();
      setDepartments([...departments, data.department]);
      setNewName("");
      toast.success("Department added");
    } catch {
      toast.error("Failed to add department");
    } finally {
      setAdding(false);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm("Remove this department?")) return;

    try {
      const res = await fetch("/api/departments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        toast.error("Failed to delete department");
        return;
      }

      setDepartments(departments.filter((d) => d.id !== id));
      toast.success("Department removed");
    } catch {
      toast.error("Failed to delete department");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-surface px-3 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2"
      >
        <Icon icon="solar:settings-broken" className="h-3.5 w-3.5" />
        Manage departments
      </button>

      <Slideover isOpen={isOpen} onClose={() => setIsOpen(false)} title="Manage departments">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDepartment()}
              placeholder="New department name"
              className="flex-1 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button size="sm" onClick={addDepartment} disabled={adding || !newName.trim()}>
              {adding ? <Icon icon="solar:loading-bold" className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Icon icon="solar:loading-bold" className="h-5 w-5 animate-spin text-text-lo" />
            </div>
          ) : departments.length === 0 ? (
            <p className="text-center text-sm text-text-lo">No departments yet</p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-sm text-text-hi">{dept.name}</span>
                  <button
                    onClick={() => deleteDepartment(dept.id)}
                    className="text-xs font-medium text-status-danger hover:text-status-danger/80"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Slideover>
    </>
  );
}
