"use client";

import { useState } from "react";

export type TicketHolder = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dietaryRequirements: string;
  isPurchaser: boolean;
};

type TicketHolderListProps = {
  quantity: number;
  purchaserName?: {
    firstName: string;
    lastName: string;
  };
  onChange?: (holders: TicketHolder[]) => void;
};

function createEmptyHolder(): TicketHolder {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dietaryRequirements: "No restrictions",
    isPurchaser: false,
  };
}

export default function TicketHolderList({
  quantity,
  purchaserName,
  onChange,
}: TicketHolderListProps) {
  const [holders, setHolders] = useState<TicketHolder[]>(() => {
    return Array.from(
      { length: quantity },
      (_, index) => ({
        ...createEmptyHolder(),
        ...(index === 0 && purchaserName
          ? {
              firstName: purchaserName.firstName,
              lastName: purchaserName.lastName,
              isPurchaser: true,
            }
          : {}),
      })
    );
  });

  function updateHolder(
    index: number,
    changes: Partial<TicketHolder>
  ) {
    const updated = holders.map((holder, holderIndex) =>
      holderIndex === index
        ? { ...holder, ...changes }
        : holder
    );

    setHolders(updated);
    onChange?.(updated);
  }

  function setAsPurchaser(index: number) {
    const updated = holders.map((holder, holderIndex) => ({
      ...holder,
      isPurchaser: holderIndex === index,
    }));

    setHolders(updated);
    onChange?.(updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Player details
        </h2>

        <p className="mt-2 text-gray-400">
          Enter the name of each person attending.
          Email addresses are optional.
        </p>
      </div>

      {holders.map((holder, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Ticket {index + 1}
              </h3>

              {holder.isPurchaser && (
                <span className="text-sm text-gray-400">
                  Purchaser
                </span>
              )}
            </div>

            {!holder.isPurchaser && (
              <button
                type="button"
                onClick={() => setAsPurchaser(index)}
                className="text-sm text-gray-300 underline"
              >
                This is me
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                First name *
              </label>

              <input
                type="text"
                value={holder.firstName}
                onChange={(event) =>
                  updateHolder(index, {
                    firstName: event.target.value,
                  })
                }
                required
                className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-black outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Last name *
              </label>

              <input
                type="text"
                value={holder.lastName}
                onChange={(event) =>
                  updateHolder(index, {
                    lastName: event.target.value,
                  })
                }
                required
                className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-black outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Email address
              <span className="ml-2 text-gray-500">
                optional
              </span>
            </label>

            <input
              type="email"
              value={holder.email}
              onChange={(event) =>
                updateHolder(index, {
                  email: event.target.value,
                })
              }
              placeholder="Leave blank for guest players"
              className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-black outline-none"
            />

            <p className="mt-2 text-xs text-gray-500">
              Only enter an email if the player wants to
              receive their own ticket information.
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Phone
              <span className="ml-2 text-gray-500">
                optional
              </span>
            </label>

            <input
              type="tel"
              value={holder.phone}
              onChange={(event) =>
                updateHolder(index, {
                  phone: event.target.value,
                })
              }
              className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-black outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Dietary requirements
            </label>

            <input
              type="text"
              value={holder.dietaryRequirements}
              onChange={(event) =>
                updateHolder(index, {
                  dietaryRequirements:
                    event.target.value,
                })
              }
              placeholder="No restrictions"
              className="w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-black outline-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}