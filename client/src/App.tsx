import { Routes, Route } from "react-router-dom";
import MeetingPoint from "./pages/MeetingPoint";

export default function App(){

  return (
    <Routes>
      <Route path="/" element={<MeetingPoint />}/>
    </Routes>
  );

}