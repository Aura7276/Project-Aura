import { Archive, CircleAlert, LoaderCircle } from "lucide-react";
import { Skeleton } from "./skeleton";
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="state">
      <Archive aria-hidden />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorState({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="state error">
      <CircleAlert aria-hidden />
      {children}
    </div>
  );
}
export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="state">
      <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
      {label}
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}
export function FormMessage({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} role="alert" className="text-destructive">
      {children}
    </p>
  );
}
