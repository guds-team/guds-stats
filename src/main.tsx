// i18n first: the language, <html lang> and the title are set before the first render.
import "./app/lib/i18n";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
