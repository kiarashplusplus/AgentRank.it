"use client";

import { useState, useRef } from "react";
import { Play, Pause, Maximize2, Minimize2, RotateCcw } from "lucide-react";

interface ReplayPlayerProps {
    videoUrl: string;
    scanId?: string;
}

export function ReplayPlayer({ videoUrl, scanId }: ReplayPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (!isFullscreen) {
                videoRef.current.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
            setIsFullscreen(!isFullscreen);
        }
    };

    const changeSpeed = () => {
        const speeds = [0.5, 1, 1.5, 2];
        const currentIndex = speeds.indexOf(playbackSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newSpeed = speeds[nextIndex];

        if (videoRef.current) {
            videoRef.current.playbackRate = newSpeed;
        }
        setPlaybackSpeed(newSpeed);
    };

    const restart = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium">Agent Replay</span>
                    {scanId && (
                        <span className="text-xs text-muted-foreground">
                            #{scanId}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={restart}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Restart"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={changeSpeed}
                        className="px-2 py-1 text-xs font-mono rounded hover:bg-muted transition-colors"
                        title="Change speed"
                    >
                        {playbackSpeed}x
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Fullscreen"
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            <div className="relative group">
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full aspect-video bg-black"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    controls
                />

                {/* Large play button overlay */}
                {!isPlaying && (
                    <button
                        onClick={togglePlay}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                            <Play className="h-8 w-8 text-black ml-1" />
                        </div>
                    </button>
                )}
            </div>

            <div className="px-4 py-2 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground">
                    Watch how the AI agent navigated and analyzed the page
                </p>
            </div>
        </div>
    );
}
