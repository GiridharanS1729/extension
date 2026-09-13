import { Download, Github, Sparkles, History, RefreshCw, Keyboard, Shield, Zap } from 'lucide-react';

const Index = () => {
  const features = [
    {
      icon: Sparkles,
      title: 'Reusable Prompt Cards',
      description: 'Create, edit, clone, and organize prompts for different use cases',
    },
    {
      icon: Zap,
      title: 'Multi-Model Support',
      description: 'OpenAI, Gemini, Groq, and DeepSeek with automatic fallback',
    },
    {
      icon: RefreshCw,
      title: 'Rephrase Tool',
      description: 'Quick text rephrasing with tone controls and word limits',
    },
    {
      icon: History,
      title: 'History Tracking',
      description: 'Track all generations with full context and timestamps',
    },
    {
      icon: Keyboard,
      title: 'Keyboard Shortcuts',
      description: 'Ctrl+Shift+Y to toggle, Ctrl+Shift+C to copy output',
    },
    {
      icon: Shield,
      title: '100% Local & Private',
      description: 'No telemetry, no cloud storage, no tracking',
    },
  ];

  const providers = [
    { name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4.1', 'gpt-3.5-turbo'] },
    { name: 'Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
    { name: 'Groq', models: ['llama-3.1-70b', 'mixtral-8x7b'] },
    { name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl" />
        <div className="relative container mx-auto px-6 py-24">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-8 shadow-2xl shadow-primary/25">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
              AI Prompt Sidebar
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mb-8">
              Developer-focused Chrome Extension with reusable prompt cards, 
              multi-model support, and strict output control.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="#setup"
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Get Started
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl transition-colors flex items-center gap-2 border border-border"
              >
                <Github className="w-5 h-5" />
                View Source
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-card/50 border border-border hover:border-primary/30 transition-colors"
            >
              <feature.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Models */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Supported AI Providers</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="p-6 rounded-2xl bg-card/30 border border-border"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">{provider.name}</h3>
              <ul className="space-y-2">
                {provider.models.map((model) => (
                  <li key={model} className="text-sm text-muted-foreground font-mono">
                    • {model}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Setup Instructions */}
      <section id="setup" className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Setup Instructions</h2>
        <div className="max-w-3xl mx-auto">
          <div className="bg-card/50 rounded-2xl border border-border p-8">
            <ol className="space-y-6">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</span>
                <div>
                  <h4 className="text-foreground font-semibold mb-1">Export via GitHub</h4>
                  <p className="text-muted-foreground">Connect your GitHub account in Lovable settings and sync the project to a repository.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</span>
                <div>
                  <h4 className="text-foreground font-semibold mb-1">Clone and Install</h4>
                  <div className="bg-background rounded-lg p-4 mt-2 font-mono text-sm text-muted-foreground">
                    <code>cd chrome-extension && npm install</code>
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</span>
                <div>
                  <h4 className="text-foreground font-semibold mb-1">Build the Extension</h4>
                  <div className="bg-background rounded-lg p-4 mt-2 font-mono text-sm text-muted-foreground">
                    <code>npm run build</code>
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</span>
                <div>
                  <h4 className="text-foreground font-semibold mb-1">Load in Chrome</h4>
                  <p className="text-muted-foreground">
                    Open <code className="bg-secondary px-2 py-0.5 rounded text-primary">chrome://extensions</code>, 
                    enable Developer Mode, click "Load unpacked" and select the <code className="bg-secondary px-2 py-0.5 rounded text-primary">dist</code> folder.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">5</span>
                <div>
                  <h4 className="text-foreground font-semibold mb-1">Add API Keys</h4>
                  <p className="text-muted-foreground">Open the extension, go to Settings, and add your API keys for the providers you want to use.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Keyboard Shortcuts</h2>
        <div className="max-w-xl mx-auto">
          <div className="bg-card/50 rounded-2xl border border-border divide-y divide-border">
            {[
              { shortcut: 'Ctrl + Shift + Y', action: 'Toggle sidebar' },
              { shortcut: 'Ctrl + Shift + C', action: 'Copy last output' },
              { shortcut: 'Enter', action: 'Send prompt' },
              { shortcut: 'Shift + Enter', action: 'New line' },
            ].map((item) => (
              <div key={item.shortcut} className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">{item.action}</span>
                <kbd className="px-3 py-1.5 bg-background rounded-lg text-muted-foreground font-mono text-sm">
                  {item.shortcut}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            AI Prompt Sidebar • 100% Local • No Tracking • Open Source
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
