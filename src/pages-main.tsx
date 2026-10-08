import { createRoot } from "react-dom/client";
import { HouseApp } from "./components/HouseApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("MoreBounceLabs needs a #root element to render.");
}
createRoot(root).render(<HouseApp />);
