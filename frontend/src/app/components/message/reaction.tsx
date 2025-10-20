import { ArrowBendUpLeftIcon, SmileyIcon } from "@phosphor-icons/react";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const item = {
  hidden: { opacity: 0, scale: 0 },
  show: { opacity: 1, scale: 1 },
};

const reactions = ["👍🏼", "❤️", "😂", "😮", "🥲", "🙏🏻"];

type ReactionProps = {
  isSentFromUser: boolean;
  onReply?: () => void;
  onReaction?: (emoji: string) => void;
};

export default function Reaction({
  isSentFromUser,
  onReply,
  onReaction,
}: ReactionProps) {
  const [showReactionEmoji, setShowReactionEmoji] = useState(false);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | globalThis.MouseEvent) => {
      if (
        reactionMenuOpen &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setReactionMenuOpen(false);
        setShowReactionEmoji(false);
      }
    };

    if (reactionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [reactionMenuOpen]);

  const handleMouseLeave = () => {
    setShowReactionEmoji(false || reactionMenuOpen);
  };

  const handleMouseOver = () => {
    setShowReactionEmoji(true);
  };

  const handleEmojiClick = () => {
    setReactionMenuOpen((prev) => !prev);
  };

  const handleReplyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onReply?.();
  };

  const handleReactionClick = (
    event: MouseEvent<HTMLParagraphElement>,
    emoji: string
  ) => {
    event.stopPropagation();
    onReaction?.(emoji);
    setReactionMenuOpen(false);
    setShowReactionEmoji(false);
  };

  const renderReactionMenu = () => {
    return (
      <AnimatePresence>
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { scale: 0.8 },
            show: {
              scale: 1,
              transition: { type: "spring", bounce: 0.3, duration: 0.2 },
            },
          }}
          className={`overflow-visible rounded-full absolute z-50 -top-16 ${
            isSentFromUser ? "right-0" : "left-0"
          }`}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  type: "spring",
                  staggerChildren: 0.02,
                  staggerDirection: isSentFromUser ? -1 : 1,
                  bounce: 0.3,
                  duration: 0.02,
                },
              },
            }}
            initial="hidden"
            animate="show"
            className="bg-black/20 backdrop-blur-sm text-[rgb(var(--text-primary))] flex w-auto justify-between items-center gap-1 sm:gap-2 p-1.5 sm:p-2 px-2 sm:px-4 max-w-[90vw] overflow-x-auto rounded-full border border-white/10"
          >
            {reactions.map((reaction: string, index) => (
              <motion.p
                variants={item}
                className="text-xl sm:text-2xl md:text-3xl cursor-pointer hover:scale-125 transition-transform flex-shrink-0"
                key={index}
                onClick={(e) => handleReactionClick(e, reaction)}
              >
                {reaction}
              </motion.p>
            ))}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div
      ref={popupRef}
      className={`relative flex flex-col justify-center items-center gap-2 ${
        showReactionEmoji ? "opacity-100" : "opacity-0"
      }`}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      {onReply && (
        <button
          type="button"
          className="text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))] hover:text-[rgb(var(--text-primary))] transition"
          onClick={handleReplyClick}
        >
          <ArrowBendUpLeftIcon className="size-4" weight="bold" />
        </button>
      )}
      {reactionMenuOpen && renderReactionMenu()}
      <SmileyIcon
        weight="regular"
        className="size-5 text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))] cursor-pointer"
        onClick={handleEmojiClick}
      />
    </div>
  );
}
