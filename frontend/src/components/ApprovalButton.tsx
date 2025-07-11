import React, { useState } from "react";
import {
  Check,
  Clock,
  AlertTriangle,
  Zap,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  useTokenApprovals,
  type TokenSymbol,
} from "../hooks/useTokenApprovals";

interface ApprovalButtonProps {
  token: TokenSymbol;
  amount?: string; // If provided, will check if this specific amount is approved
  onApprovalComplete?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "minimal";
}

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  token,
  amount,
  onApprovalComplete,
  disabled = false,
  size = "md",
  variant = "primary",
}) => {
  const {
    approvalStates,
    hasApproval,
    approveExact,
    approveUnlimited,
    isApprovalPending,
    formatAllowance,
  } = useTokenApprovals();

  const [showOptions, setShowOptions] = useState(false);

  const tokenState = approvalStates[token];
  const isApproved = amount
    ? hasApproval(token, amount)
    : tokenState.isApproved;
  const currentAllowance = formatAllowance(token);

  // Button size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Button variant classes
  const variantClasses = {
    primary: "btn-citrea",
    secondary: "btn-secondary",
    minimal: "text-citrea-400 hover:text-citrea-300 underline",
  };

  const buttonClasses = `${sizeClasses[size]} ${variantClasses[variant]}`;

  const handleApprove = async (mode: "exact" | "unlimited") => {
    try {
      if (mode === "exact" && amount) {
        await approveExact(token, amount);
      } else {
        await approveUnlimited(token);
      }

      setShowOptions(false);
      onApprovalComplete?.();
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  // If already approved for the required amount
  if (isApproved && !isApprovalPending) {
    if (variant === "minimal") {
      return (
        <span className="flex items-center text-green-400 text-sm">
          <Check className="w-4 h-4 mr-1" />
          Approved
        </span>
      );
    }

    return (
      <button
        className={`${buttonClasses} bg-green-500/20 border-green-500/50 text-green-400 cursor-default`}
        disabled
      >
        <Check className="w-4 h-4 mr-2" />
        {currentAllowance === "Unlimited" ? "Unlimited Approved" : "Approved"}
      </button>
    );
  }

  // If approval is pending
  if (isApprovalPending) {
    return (
      <button
        className={`${buttonClasses} cursor-not-allowed opacity-70`}
        disabled
      >
        <Clock className="w-4 h-4 mr-2 animate-spin" />
        Approving...
      </button>
    );
  }

  // Show approval options
  if (showOptions && amount) {
    return (
      <div className="relative">
        <div className="glass-card p-4 border border-citrea-500/30">
          <div className="space-y-3">
            <div className="text-sm font-medium text-pool-text mb-3">
              Approve {token} for trading
            </div>

            {/* Exact Amount Option */}
            <button
              onClick={() => handleApprove("exact")}
              disabled={disabled}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-pool-border hover:border-citrea-500/50 bg-pool-dark/50 hover:bg-citrea-500/5 transition-all"
            >
              <div className="flex items-center">
                <Zap className="w-4 h-4 mr-3 text-orange-400" />
                <div className="text-left">
                  <div className="text-sm font-medium text-pool-text">
                    Exact Amount
                  </div>
                  <div className="text-xs text-pool-muted">
                    Approve {amount} {token}
                  </div>
                </div>
              </div>
              <div className="text-xs text-pool-muted">
                Lower gas, repeat for each trade
              </div>
            </button>

            {/* Unlimited Option */}
            <button
              onClick={() => handleApprove("unlimited")}
              disabled={disabled}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-pool-border hover:border-citrea-500/50 bg-pool-dark/50 hover:bg-citrea-500/5 transition-all"
            >
              <div className="flex items-center">
                <InfinityIcon className="w-4 h-4 mr-3 text-citrea-400" />
                <div className="text-left">
                  <div className="text-sm font-medium text-pool-text">
                    Unlimited
                  </div>
                  <div className="text-xs text-pool-muted">
                    Approve unlimited {token}
                  </div>
                </div>
              </div>
              <div className="text-xs text-pool-muted">
                Higher gas, trade without approval
              </div>
            </button>

            {/* Cancel */}
            <button
              onClick={() => setShowOptions(false)}
              className="w-full text-sm text-pool-muted hover:text-pool-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main approval button
  if (variant === "minimal") {
    return (
      <button
        onClick={() =>
          amount ? setShowOptions(true) : handleApprove("unlimited")
        }
        disabled={disabled}
        className="text-citrea-400 hover:text-citrea-300 underline text-sm flex items-center"
      >
        <AlertTriangle className="w-4 h-4 mr-1" />
        Approve {token}
      </button>
    );
  }

  return (
    <button
      onClick={() =>
        amount ? setShowOptions(true) : handleApprove("unlimited")
      }
      disabled={disabled}
      className={buttonClasses}
    >
      <AlertTriangle className="w-4 h-4 mr-2" />
      Approve {token}
    </button>
  );
};

export default ApprovalButton;
