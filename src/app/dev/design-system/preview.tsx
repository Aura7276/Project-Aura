"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowDown, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toast, ToastProvider } from "@/components/ui/toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  FormMessage,
} from "@/components/ui/feedback";
import { specimenTitle } from "@/validation/specimen";
const colors = [
  ["Studio ink", "#20231F"],
  ["Violet", "#7457E8"],
  ["Paper", "#F7F6F0"],
  ["Forest", "#243D32"],
  ["Citron", "#D9EC93"],
  ["Peach", "#F4B8A6"],
  ["Sage", "#DCEBE5"],
  ["White", "#FFFFFF"],
  ["Primary text", "#242137"],
  ["Muted text", "#62665E"],
];
export function Preview() {
  const [toast, setToast] = useState(false);
  const [sample, setSample] = useState("Aa");
  const form = useForm<{ title: string }>({ defaultValues: { title: "" } });
  return (
    <TooltipProvider>
      <ToastProvider>
        <header className="mast">
          <div className="shell flex items-center justify-between">
            <a href="#top" className="wordmark">
              AURA
            </a>
            <span>Development preview</span>
          </div>
        </header>
        <main id="top" className="shell pb-20">
          <section className="intro">
            <div>
              <p className="eyebrow">Creative Premium</p>
              <h1>Design system</h1>
              <a href="#controls" className="jump">
                Explore components <ArrowDown size={16} />
              </a>
            </div>
            <div
              className="specimen"
              aria-label="Plus Jakarta Sans type specimen"
            >
              <span>{sample}</span>
              <small>Plus Jakarta Sans</small>
            </div>
          </section>
          <section aria-labelledby="palette">
            <h2 id="palette">Colour palette</h2>
            <div className="palette">
              {colors.map(([name, hex]) => (
                <div key={name}>
                  <div className="swatch" style={{ backgroundColor: hex }} />
                  <strong>{name}</strong>
                  <small>{hex}</small>
                </div>
              ))}
            </div>
          </section>
          <section id="controls">
            <h2>Components</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="panel">
                <h3>Form controls</h3>
                <form
                  noValidate
                  onSubmit={form.handleSubmit(({ title }) => {
                    setSample(title.trim());
                    setToast(true);
                  })}
                >
                  <label htmlFor="title">Type specimen</label>
                  <Input
                    id="title"
                    placeholder="Enter a short name"
                    aria-invalid={!!form.formState.errors.title}
                    aria-describedby={
                      form.formState.errors.title ? "title-error" : undefined
                    }
                    {...form.register("title", {
                      validate: (value) => {
                        const result = specimenTitle.safeParse(value);
                        return result.success || result.error.issues[0].message;
                      },
                    })}
                  />
                  {form.formState.errors.title && (
                    <FormMessage id="title-error">
                      {form.formState.errors.title.message}
                    </FormMessage>
                  )}
                  <Button type="submit" className="mt-3">
                    Apply specimen
                  </Button>
                </form>
                <label htmlFor="weight">Sample weight</label>
                <NativeSelect
                  id="weight"
                  defaultValue="Bold"
                  onChange={(e) =>
                    document
                      .getElementById("weight-example")
                      ?.style.setProperty(
                        "font-weight",
                        e.target.value === "Bold" ? "700" : "400",
                      )
                  }
                >
                  <option>Bold</option>
                  <option>Regular</option>
                </NativeSelect>
                <p id="weight-example" className="font-bold">
                  Inter interface sample
                </p>
                <label className="flex items-center gap-3">
                  <Checkbox /> Enable option
                </label>
                <RadioGroup
                  defaultValue="compact"
                  aria-label="Density specimen"
                >
                  {["compact", "comfortable"].map((v) => (
                    <label
                      key={v}
                      className="flex items-center gap-3 capitalize"
                    >
                      <RadioGroupItem value={v} />
                      {v}
                    </label>
                  ))}
                </RadioGroup>
              </Card>
              <Card className="panel">
                <h3>Actions & overlays</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>Open dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogTitle>Dialog specimen</DialogTitle>
                      <DialogDescription>
                        Press Escape or use the close control to return.
                      </DialogDescription>
                    </DialogContent>
                  </Dialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        Sample text <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {["Aa", "AURA"].map((v) => (
                        <DropdownMenuItem key={v} onSelect={() => setSample(v)}>
                          {v}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="About the sample"
                      >
                        <Info />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Changes apply to this preview.
                    </TooltipContent>
                  </Tooltip>
                  <Button variant="secondary" onClick={() => setToast(true)}>
                    Show toast
                  </Button>
                  <Button disabled>Disabled</Button>
                </div>
                <h3>Status & feedback</h3>
                <div>
                  <Badge variant="secondary">Preview</Badge>
                </div>
                <Tabs defaultValue="empty">
                  <TabsList aria-label="Feedback states">
                    {["Empty", "Loading", "Error"].map((t) => (
                      <TabsTrigger value={t.toLowerCase()} key={t}>
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="empty">
                    <EmptyState title="No specimens saved">
                      Applied samples last until you refresh this page.
                    </EmptyState>
                  </TabsContent>
                  <TabsContent value="loading">
                    <LoadingState label="Loading specimen…" />
                  </TabsContent>
                  <TabsContent value="error">
                    <ErrorState>
                      Example error. The specimen could not be loaded.
                    </ErrorState>
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </section>
        </main>
        <Toast open={toast} onOpenChange={setToast}>
          Preview notification
        </Toast>
      </ToastProvider>
    </TooltipProvider>
  );
}
