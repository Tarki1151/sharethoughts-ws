import Image from "next/image";
import Link from 'next/link';

export default function Home() {
  return (
    <div className="text-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block">Collaborate on Documents</span>
          <span className="block text-indigo-600">with AI-Powered Moderation</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          ShareThoughts brings people together to collaborate on documents with real-time translation, AI moderation, and seamless version control.
        </p>
        <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <Link
              href="/register"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
            >
              Get Started
            </Link>
          </div>
          <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
            <Link
              href="/documents"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
            >
              Browse Documents
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">How It Works</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="p-6 bg-white rounded-lg shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl font-bold">1</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload & Share</h3>
            <p className="text-gray-600">Upload your documents and share them with collaborators across the globe.</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl font-bold">2</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Real-time Collaboration</h3>
            <p className="text-gray-600">Work together in real-time with built-in chat and document editing.</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-indigo-600 text-xl font-bold">3</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI-Powered Features</h3>
            <p className="text-gray-600">Get AI-powered suggestions, translations, and content moderation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
