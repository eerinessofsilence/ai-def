import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useParams } from "react-router-dom";
import Shell from "./Shell";
import Login from "./Login";
import Products from "./Products";
import Inquiries, { InquiryDetail } from "./Inquiries";
import Pages, { PageEditorRoute } from "./Pages";
import Settings from "./Settings";
import { SessionProvider } from "./session";
import { Loading } from "./ui";
import "./cms.css";

const ArmsEditor = lazy(() => import("./ArmsEditor"));
const Preview = lazy(() => import("./Preview"));
const ContentEditor = lazy(() => import("./ContentEditor"));
const MediaLibrary = lazy(() => import("./MediaLibrary"));
// This entry mounts its own root and disposes it on hot replacement.
// eslint-disable-next-line react-refresh/only-export-components
function Editor() {
  const { site } = useParams();
  return <Suspense fallback={<Loading />}>{site === "arms" ? <ArmsEditor /> : <ContentEditor />}</Suspense>;
}
const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/:site/preview/:id/:lng", element: <Suspense fallback={<Loading />}><Preview /></Suspense> },
  { path: "/", element: <Shell />, children: [
    { path: ":site/inquiries", element: <Inquiries /> },
    { path: ":site/inquiries/:id", element: <InquiryDetail /> },
    { path: ":site/pages", element: <Pages /> },
    { path: ":site/pages/:id", element: <PageEditorRoute /> },
    { path: ":site/settings", element: <Settings /> },
    { path: ":site/media", element: <Suspense fallback={<Loading />}><MediaLibrary /></Suspense> },
    { path: ":site/:kind", element: <Products /> },
    { path: ":site/:kind/:id", element: <Editor /> },
    { path: "*", element: <p className="cms-page">Page not found. Select a section from the menu.</p> },
  ] },
], { basename: "/cms" });

const root = document.getElementById("root");
if (!root) throw new Error("CMS root is missing");
const app = ReactDOM.createRoot(root);
app.render(<React.StrictMode><SessionProvider><RouterProvider router={router} /></SessionProvider></React.StrictMode>);
import.meta.hot?.dispose(() => { app.unmount(); router.dispose(); });
