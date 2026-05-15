import React, { useState } from 'react';
import Navbar from '~/components/Navbar';
import FileUploader from '~/components/FileUploader';
import { usePuterStore } from '~/lib/puter';
import { convertPdfToImage } from '~/lib/pdf2img';
import { generateUUID } from '~/lib/utils';
import { prepareInstructions } from '../../constants';

const Upload = () => {
  const { fs, ai, kv } = usePuterStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<any>(null); // ← New: Store result
  const [error, setError] = useState<string>('');

  const handleFileSelect = (file: File | null): void => {
    setFile(file);
    setResult(null);
    setError('');
  };

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    try {
      setIsProcessing(true);
      setError('');
      setResult(null);
      console.log('🚀 Starting analysis...');

      // Upload PDF
      setStatusText('Uploading PDF...');
      const uploadedFile = await fs.upload([file]);
      if (!uploadedFile?.path) throw new Error('Failed to upload PDF');

      // Convert & Upload Image
      setStatusText('Converting PDF to image...');
      const imageFile = await convertPdfToImage(file);
      if (!imageFile?.file) throw new Error('PDF to image conversion failed');

      setStatusText('Uploading image...');
      const uploadedImage = await fs.upload([imageFile.file]);
      if (!uploadedImage?.path) throw new Error('Failed to upload image');

      // Save initial data
      const uuid = generateUUID();
      const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName: companyName || 'Unknown',
        jobTitle,
        jobDescription,
        feedback: null,
      };

      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      // AI Analysis
      setStatusText('Analyzing resume with AI...');
      const feedbackResponse = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({ jobTitle, jobDescription }),
      );

      console.log('📥 Raw AI Response:', feedbackResponse);

      if (!feedbackResponse) throw new Error('No response from AI');

      const feedbackText =
        typeof feedbackResponse.message.content === 'string'
          ? feedbackResponse.message.content
          : feedbackResponse.message.content?.[0]?.text || '';

      console.log('📝 Extracted Text:', feedbackText);

      // Parse JSON
      let parsedFeedback;
      try {
        let clean = feedbackText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/gm, '');

        const match = clean.match(/(\{[\s\S]*\})/);
        if (match) clean = match[1];

        parsedFeedback = JSON.parse(clean);
        console.log('✅ Parsed Successfully:', parsedFeedback);
      } catch (err) {
        console.error('❌ JSON Parse Failed', err);
        parsedFeedback = {
          atsScore: 0,
          summary: feedbackText || 'Could not parse AI response',
          strengths: [],
          weaknesses: [],
          improvements: [],
        };
      }

      const finalData = { ...data, feedback: parsedFeedback };
      await kv.set(`resume:${uuid}`, JSON.stringify(finalData));

      // Show result on screen
      setResult(finalData);
      setStatusText('Analysis Complete');

      console.log('🎉 Final Result:', finalData);
    } catch (err: any) {
      console.error('💥 Error:', err);
      setError(err.message || 'Something went wrong');
      setStatusText('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const companyName = formData.get('company-name') as string;
    const jobTitle = formData.get('job-title') as string;
    const jobDescription = formData.get('job-description') as string;

    if (!file) return alert('Please upload a resume');
    if (!jobTitle || !jobDescription)
      return alert('Job Title and Description are required');

    await handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen pb-12">
      <Navbar />

      <section className="main-section">
        <div className="page-heading py-16">
          <h1>Smart feedback for your dream job</h1>

          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img
                src="/images/resume-scan.gif"
                alt="Scanning"
                className="w-full max-w-md mx-auto mt-6"
              />
            </>
          ) : result ? (
            <div className="max-w-4xl mx-auto mt-8">
              <h2 className="text-2xl font-bold mb-6">Analysis Result</h2>

              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <p className="text-sm text-gray-500">ATS Score</p>
                  <div className="text-6xl font-bold text-blue-600">
                    {result.feedback?.atsScore || 0}
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-3">Summary</h3>
                <p className="text-gray-700 leading-relaxed mb-8">
                  {result.feedback?.summary}
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-600 mb-3">
                      ✅ Strengths
                    </h4>
                    <ul className="space-y-2">
                      {result.feedback?.strengths?.map(
                        (item: string, i: number) => (
                          <li key={i}>• {item}</li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-600 mb-3">
                      ⚠️ Weaknesses
                    </h4>
                    <ul className="space-y-2">
                      {result.feedback?.weaknesses?.map(
                        (item: string, i: number) => (
                          <li key={i}>• {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>

                {result.feedback?.improvements?.length > 0 && (
                  <div className="mt-8">
                    <h4 className="font-semibold mb-3">💡 Improvements</h4>
                    <ul className="space-y-2">
                      {result.feedback.improvements.map(
                        (item: string, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span>→</span> <span>{item}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="mt-6 primary-button"
              >
                Analyze Another Resume
              </button>
            </div>
          ) : (
            <>
              <h2>Drop your resume for an ATS score and improvement tips</h2>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 mt-8 max-w-2xl mx-auto"
              >
                <div className="form-div">
                  <label>Company Name</label>
                  <input
                    type="text"
                    name="company-name"
                    placeholder="e.g. Google"
                  />
                </div>

                <div className="form-div">
                  <label>Job Title</label>
                  <input
                    type="text"
                    name="job-title"
                    placeholder="e.g. Software Engineer"
                    required
                  />
                </div>

                <div className="form-div">
                  <label>Job Description</label>
                  <textarea
                    rows={6}
                    name="job-description"
                    placeholder="Paste full job description..."
                    required
                  />
                </div>

                <div className="form-div">
                  <label>Upload Resume (PDF)</label>
                  <FileUploader onFileSelect={handleFileSelect} />
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={isProcessing || !file}
                >
                  Analyze Resume
                </button>
              </form>
            </>
          )}

          {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </div>
      </section>
    </main>
  );
};

export default Upload;
