import React from "react";
import { formatEther } from "viem";

interface OrderFillProgressProps {
  filledAmount?: string;
  totalAmount: string;
  fillPercentage?: number;
  isPartiallyFilled?: boolean;
  isFullyExecuted?: boolean;
  tokenSymbol: string;
  compact?: boolean;
}

const OrderFillProgress: React.FC<OrderFillProgressProps> = ({
  filledAmount = "0",
  totalAmount,
  fillPercentage = 0,
  isPartiallyFilled = false,
  isFullyExecuted = false,
  tokenSymbol,
  compact = false,
}) => {
  // Calculate values for display
  const filled = parseFloat(formatEther(BigInt(filledAmount || "0")));
  const total = parseFloat(formatEther(BigInt(totalAmount)));
  const remaining = total - filled;
  const actualPercentage =
    fillPercentage || (total > 0 ? (filled / total) * 100 : 0);

  // Get status color based on fill state
  const getStatusColor = () => {
    if (isFullyExecuted) return "bg-green-500";
    if (isPartiallyFilled) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getStatusTextColor = () => {
    if (isFullyExecuted) return "text-green-400";
    if (isPartiallyFilled) return "text-yellow-400";
    return "text-blue-400";
  };

  const getBorderColor = () => {
    if (isFullyExecuted) return "border-green-500/20";
    if (isPartiallyFilled) return "border-yellow-500/20";
    return "border-blue-500/20";
  };

  const getBackgroundColor = () => {
    if (isFullyExecuted) return "bg-green-500/5";
    if (isPartiallyFilled) return "bg-yellow-500/5";
    return "bg-blue-500/5";
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {/* Compact progress bar */}
        <div className="flex-1 min-w-[60px]">
          <div className="w-full bg-pool-border rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${getStatusColor()}`}
              style={{ width: `${Math.min(actualPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Compact percentage */}
        <span className={`text-xs font-medium ${getStatusTextColor()}`}>
          {actualPercentage.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-lg border ${getBorderColor()} ${getBackgroundColor()}`}
    >
      {/* Fill Status Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
          <span className={`text-sm font-medium ${getStatusTextColor()}`}>
            {isFullyExecuted
              ? "Fully Executed"
              : isPartiallyFilled
              ? "Partially Filled"
              : "Ready for Fill"}
          </span>
        </div>
        <span className={`text-sm font-bold ${getStatusTextColor()}`}>
          {actualPercentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-pool-border rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getStatusColor()}`}
          style={{ width: `${Math.min(actualPercentage, 100)}%` }}
        ></div>
      </div>

      {/* Fill Details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-pool-muted mb-1">Filled</div>
          <div className="text-pool-text font-medium">
            {filled.toFixed(4)} {tokenSymbol}
          </div>
        </div>
        <div>
          <div className="text-pool-muted mb-1">Remaining</div>
          <div className="text-pool-text font-medium">
            {remaining.toFixed(4)} {tokenSymbol}
          </div>
        </div>
      </div>

      {/* Total Amount */}
      <div className="mt-2 pt-2 border-t border-pool-border/50">
        <div className="text-xs text-pool-muted">
          Total:{" "}
          <span className="text-pool-text font-medium">
            {total.toFixed(4)} {tokenSymbol}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrderFillProgress;
