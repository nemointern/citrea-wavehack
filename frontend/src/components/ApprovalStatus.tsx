import React from "react";
import {
  Check,
  X,
  Clock,
  Infinity as InfinityIcon,
  AlertTriangle,
} from "lucide-react";
import {
  useTokenApprovals,
  type TokenSymbol,
} from "../hooks/useTokenApprovals";

interface ApprovalStatusProps {
  token: TokenSymbol;
  requiredAmount?: string;
  showBalance?: boolean;
  compact?: boolean;
}

export const ApprovalStatus: React.FC<ApprovalStatusProps> = ({
  token,
  requiredAmount,
  showBalance = true,
  compact = false,
}) => {
  const {
    approvalStates,
    hasApproval,
    hasBalance,
    formatAllowance,
    formatBalance,
  } = useTokenApprovals();

  const tokenState = approvalStates[token];
  const isLoading = tokenState.isLoading;
  const currentAllowance = formatAllowance(token);
  const currentBalance = formatBalance(token);

  const isApproved = requiredAmount
    ? hasApproval(token, requiredAmount)
    : tokenState.isApproved;

  const hasSufficientBalance = requiredAmount
    ? hasBalance(token, requiredAmount)
    : true;

  // Status icon component
  const StatusIcon = () => {
    if (isLoading) {
      return <Clock className="w-4 h-4 text-pool-muted animate-spin" />;
    }

    if (isApproved) {
      return <Check className="w-4 h-4 text-green-400" />;
    }

    return <X className="w-4 h-4 text-red-400" />;
  };

  // Status text
  const getStatusText = () => {
    if (isLoading) return "Loading...";
    if (isApproved) return "Approved";
    return "Not Approved";
  };

  // Status color
  const getStatusColor = () => {
    if (isLoading) return "text-pool-muted";
    if (isApproved) return "text-green-400";
    return "text-red-400";
  };

  // Compact view
  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <StatusIcon />
        <span className={`text-sm ${getStatusColor()}`}>
          {token} {getStatusText()}
        </span>
        {requiredAmount && !hasSufficientBalance && (
          <AlertTriangle className="w-4 h-4 text-orange-400" />
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="glass-card p-4 border border-pool-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-citrea-500 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {token.charAt(0)}
            </span>
          </div>
          <div>
            <h4 className="font-medium text-pool-text">{token}</h4>
            <p className="text-xs text-pool-muted">Token Approval</p>
          </div>
        </div>
        <StatusIcon />
      </div>

      <div className="space-y-2">
        {/* Approval Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-pool-muted">Status:</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {/* Current Allowance */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-pool-muted">Current Allowance:</span>
          <span className="text-sm text-pool-text font-mono flex items-center">
            {currentAllowance === "Unlimited" && (
              <InfinityIcon className="w-3 h-3 mr-1 text-citrea-400" />
            )}
            {currentAllowance} {token}
          </span>
        </div>

        {/* Required Amount */}
        {requiredAmount && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-pool-muted">Required:</span>
            <span className="text-sm text-pool-text font-mono">
              {requiredAmount} {token}
            </span>
          </div>
        )}

        {/* Balance */}
        {showBalance && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-pool-muted">Balance:</span>
            <span
              className={`text-sm font-mono ${
                hasSufficientBalance ? "text-pool-text" : "text-orange-400"
              }`}
            >
              {currentBalance} {token}
            </span>
          </div>
        )}

        {/* Insufficient Balance Warning */}
        {requiredAmount && !hasSufficientBalance && (
          <div className="flex items-center space-x-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">
              Insufficient {token} balance
            </span>
          </div>
        )}

        {/* Approval Needed Warning */}
        {requiredAmount && !isApproved && hasSufficientBalance && (
          <div className="flex items-center space-x-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">
              Token approval required for trading
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalStatus;
