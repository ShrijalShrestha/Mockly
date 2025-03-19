import { useState, useRef } from "react";
import axios from "axios";

function Add() {
  const [resume, setResume] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [feedbackAudio, setFeedbackAudio] = useState(null);

  const startRecording = async (question) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        sendAudioToBackend(question, audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setCurrentQuestion(question);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Error accessing your microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendAudioToBackend = async (question, audioBlob) => {
    if (!audioBlob) return;

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("question", question);

    try {
      const response = await axios.post("http://localhost:8000/process_audio/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setResponses(prev => ({ ...prev, [question]: response.data.transcription }));
      setFeedbackAudio(response.data.feedback_audio);
    } catch (error) {
      console.error("Error sending audio to backend:", error);
    }
  };

  const handleFileChange = (event) => {
    setResume(event.target.files[0]);
  };

  const uploadResume = async () => {
    if (!resume) return alert("Please select a resume!");

    const formData = new FormData();
    formData.append("file", resume);

    try {
      const response = await axios.post("http://localhost:8000/upload_resume/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setParsedData(response.data.parsed_data);
    } catch (error) {
      console.error("Error uploading resume:", error);
    }
  };

  const generateQuestions = async () => {
    if (!parsedData) {
      alert("No resume data available!");
      return;
    }
  
    try {
      const response = await axios.post("http://localhost:8000/generate_questions/", 
        { data: parsedData },  // Send resume data in JSON format
        { headers: { "Content-Type": "application/json" } }
      );
  
      const { question, audio_url } = response.data;
      setQuestions([question]);
  
      const audio = new Audio(audio_url);
      audio.play();
    } catch (error) {
      console.error("Error generating questions:", error);
      setQuestions([]);
    }
  };
  

  return (
    <div className="container">
      <h1>AI Interview System</h1>
      <div>
        <input type="file" onChange={handleFileChange} accept=".pdf" />
        <button onClick={uploadResume}>Upload Resume</button>
      </div>
      {parsedData && (
        <div>
          <h3>Extracted Resume Data:</h3>
          <pre>{parsedData}</pre>
          <button onClick={generateQuestions}>Generate Questions</button>
        </div>
      )}
      {questions.length > 0 && (
        <div>
          <h3>Generated Questions:</h3>
          {questions.map((question, index) => (
            <div key={index}>
              <h3>AI Interviewer</h3>
              <p>{question}</p>
              <button 
                onClick={() => startRecording(question)}
                disabled={isRecording}
              >
                {isRecording && currentQuestion === question ? 'Recording...' : 'Start Voice Input'}
              </button>
              {isRecording && currentQuestion === question && (
                <button onClick={stopRecording}>Stop Recording</button>
              )}
            </div>
          ))}
        </div>
      )}
      {feedbackAudio && (
        <div>
          <h3>AI Feedback</h3>
          <audio controls>
            <source src={feedbackAudio} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
}

export default Add;
