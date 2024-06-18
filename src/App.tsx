import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Main from "./Main";
import PPT from "./PPT";
import CRAWL from "./CRAWL";

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Main />} />
      <Route path="/ppt" element={<PPT />} />
      <Route path="/crawl" element={<CRAWL />} />
    </Routes>
  </BrowserRouter>
);

export default App;
