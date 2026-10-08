import { createFileRoute } from "@tanstack/react-router";
import { HouseApp } from "@/components/HouseApp";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export const Route = createFileRoute("/")({ component: () => <AppErrorBoundary><HouseApp /></AppErrorBoundary> });
