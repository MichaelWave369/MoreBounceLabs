import { createFileRoute } from "@tanstack/react-router";
import { HouseApp } from "@/components/HouseApp";

export const Route = createFileRoute("/")({ component: HouseApp });
