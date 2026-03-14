import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listVenues,
  listPitches,
  createVenue,
  updateVenue,
  createPitch,
  updatePitch,
} from "../api/venues";
import type { Venue, Pitch } from "../api/venues";
import { PageHeader } from "../components/PageHeader";
import { ErrorMsg } from "../components/ErrorMsg";
import { colors, css } from "../styles";

type VenueFormData = {
  name: string;
  addressText: string;
  mapsUrl: string;
  isActive: boolean;
};

type PitchFormData = {
  name: string;
  pitchType: string;
  price: string;
};

const EMPTY_VENUE: VenueFormData = {
  name: "",
  addressText: "",
  mapsUrl: "",
  isActive: true,
};
const EMPTY_PITCH: PitchFormData = { name: "", pitchType: "F5", price: "" };

export function VenuesPage() {
  const queryClient = useQueryClient();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueForm, setVenueForm] = useState<VenueFormData>(EMPTY_VENUE);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [showPitchForm, setShowPitchForm] = useState(false);
  const [pitchForm, setPitchForm] = useState<PitchFormData>(EMPTY_PITCH);
  const [editingPitchId, setEditingPitchId] = useState<string | null>(null);

  const {
    data: venues,
    error: venuesError,
    isLoading: venuesLoading,
  } = useQuery({
    queryKey: ["venues"],
    queryFn: listVenues,
  });

  const { data: pitches, error: pitchesError } = useQuery({
    queryKey: ["pitches", selectedVenueId],
    queryFn: () => listPitches(selectedVenueId!),
    enabled: selectedVenueId !== null,
  });

  const selectedVenue = venues?.find((v) => v.id === selectedVenueId) ?? null;

  const createVenueMutation = useMutation({
    mutationFn: (data: VenueFormData) =>
      createVenue({
        name: data.name,
        addressText: data.addressText || null,
        mapsUrl: data.mapsUrl || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["venues"] });
      setShowVenueForm(false);
      setVenueForm(EMPTY_VENUE);
    },
  });

  const updateVenueMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VenueFormData }) =>
      updateVenue(id, {
        name: data.name,
        addressText: data.addressText || null,
        mapsUrl: data.mapsUrl || null,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["venues"] });
      setEditingVenueId(null);
      setVenueForm(EMPTY_VENUE);
    },
  });

  const createPitchMutation = useMutation({
    mutationFn: ({ venueId, data }: { venueId: string; data: PitchFormData }) =>
      createPitch(venueId, {
        name: data.name,
        pitchType: data.pitchType,
        price: data.price ? parseFloat(data.price) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["pitches", selectedVenueId],
      });
      void queryClient.invalidateQueries({ queryKey: ["venues"] });
      setShowPitchForm(false);
      setPitchForm(EMPTY_PITCH);
    },
  });

  const updatePitchMutation = useMutation({
    mutationFn: ({
      venueId,
      pitchId,
      data,
    }: {
      venueId: string;
      pitchId: string;
      data: PitchFormData;
    }) =>
      updatePitch(venueId, pitchId, {
        name: data.name,
        pitchType: data.pitchType,
        price: data.price ? parseFloat(data.price) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["pitches", selectedVenueId],
      });
      setEditingPitchId(null);
      setPitchForm(EMPTY_PITCH);
    },
  });

  function openEditVenue(v: Venue) {
    setEditingVenueId(v.id);
    setVenueForm({
      name: v.name,
      addressText: v.addressText ?? "",
      mapsUrl: v.mapsUrl ?? "",
      isActive: v.isActive,
    });
  }

  function openEditPitch(p: Pitch) {
    setEditingPitchId(p.id);
    setPitchForm({
      name: p.name,
      pitchType: p.pitchType,
      price: p.price !== null ? String(p.price) : "",
    });
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <PageHeader
        title="Predios y canchas"
        action={
          <button onClick={() => setShowVenueForm(true)} style={css.btnPrimary}>
            + Nuevo predio
          </button>
        }
      />

      <ErrorMsg error={venuesError} />
      <ErrorMsg error={pitchesError} />
      <ErrorMsg error={createVenueMutation.error} />
      <ErrorMsg error={updateVenueMutation.error} />
      <ErrorMsg error={createPitchMutation.error} />
      <ErrorMsg error={updatePitchMutation.error} />

      {showVenueForm && (
        <VenueForm
          form={venueForm}
          onChange={setVenueForm}
          onSubmit={() => createVenueMutation.mutate(venueForm)}
          onCancel={() => {
            setShowVenueForm(false);
            setVenueForm(EMPTY_VENUE);
          }}
          loading={createVenueMutation.isPending}
          title="Nuevo predio"
        />
      )}

      {venuesLoading && <p style={{ color: colors.muted }}>Cargando...</p>}

      <div
        style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}
      >
        {/* Venue list */}
        <div>
          {venues?.map((v) =>
            editingVenueId === v.id ? (
              <VenueForm
                key={v.id}
                form={venueForm}
                onChange={setVenueForm}
                onSubmit={() =>
                  updateVenueMutation.mutate({ id: v.id, data: venueForm })
                }
                onCancel={() => {
                  setEditingVenueId(null);
                  setVenueForm(EMPTY_VENUE);
                }}
                loading={updateVenueMutation.isPending}
                title="Editar venue"
              />
            ) : (
              <div
                key={v.id}
                onClick={() => setSelectedVenueId(v.id)}
                style={{
                  ...css.card,
                  marginBottom: 12,
                  cursor: "pointer",
                  borderColor:
                    selectedVenueId === v.id ? colors.accent : colors.border,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: colors.text,
                        marginBottom: 4,
                      }}
                    >
                      {v.name}
                    </div>
                    {v.addressText && (
                      <div style={{ fontSize: 12, color: colors.muted }}>
                        {v.addressText}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 12,
                        color: v.isActive ? colors.success : colors.danger,
                        marginTop: 4,
                      }}
                    >
                      {v.isActive ? "Activo" : "Inactivo"} · {v.pitchCount}{" "}
                      canchas
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditVenue(v);
                    }}
                    style={{
                      ...css.btnSecondary,
                      fontSize: 12,
                      padding: "4px 10px",
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            ),
          )}
        </div>

        {/* Pitches panel */}
        {selectedVenue && (
          <div style={css.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: colors.text }}>
                Canchas — {selectedVenue.name}
              </h3>
              <button
                onClick={() => {
                  setShowPitchForm(true);
                  setEditingPitchId(null);
                  setPitchForm(EMPTY_PITCH);
                }}
                style={{ ...css.btnPrimary, fontSize: 13 }}
              >
                + Cancha
              </button>
            </div>

            {showPitchForm && (
              <PitchForm
                form={pitchForm}
                onChange={setPitchForm}
                onSubmit={() =>
                  createPitchMutation.mutate({
                    venueId: selectedVenue.id,
                    data: pitchForm,
                  })
                }
                onCancel={() => {
                  setShowPitchForm(false);
                  setPitchForm(EMPTY_PITCH);
                }}
                loading={createPitchMutation.isPending}
                title="Nueva cancha"
              />
            )}

            {pitches?.map((p) =>
              editingPitchId === p.id ? (
                <PitchForm
                  key={p.id}
                  form={pitchForm}
                  onChange={setPitchForm}
                  onSubmit={() =>
                    updatePitchMutation.mutate({
                      venueId: selectedVenue.id,
                      pitchId: p.id,
                      data: pitchForm,
                    })
                  }
                  onCancel={() => {
                    setEditingPitchId(null);
                    setPitchForm(EMPTY_PITCH);
                  }}
                  loading={updatePitchMutation.isPending}
                  title="Editar cancha"
                />
              ) : (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: colors.text }}>
                      {p.name}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: colors.muted,
                      }}
                    >
                      {p.pitchType}
                      {p.price !== null && ` · $${p.price}`}
                      {!p.isActive && (
                        <span style={{ marginLeft: 6, color: colors.danger }}>
                          inactiva
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditPitch(p)}
                    style={{
                      ...css.btnSecondary,
                      fontSize: 12,
                      padding: "4px 10px",
                    }}
                  >
                    Editar
                  </button>
                </div>
              ),
            )}

            {pitches?.length === 0 && !showPitchForm && (
              <p style={{ color: colors.muted, fontSize: 14 }}>
                Sin canchas. Agregá una.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VenueForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  loading,
  title,
}: {
  form: VenueFormData;
  onChange: (f: VenueFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  title: string;
}) {
  return (
    <div style={{ ...css.card, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, color: colors.text }}>
        {title}
      </h3>
      <Field label="Nombre">
        <input
          style={css.input}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Dirección">
        <input
          style={css.input}
          value={form.addressText}
          onChange={(e) => onChange({ ...form, addressText: e.target.value })}
        />
      </Field>
      <Field label="Maps URL">
        <input
          style={css.input}
          value={form.mapsUrl}
          onChange={(e) => onChange({ ...form, mapsUrl: e.target.value })}
        />
      </Field>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
          id="isActive"
        />
        <label htmlFor="isActive" style={{ fontSize: 14, color: colors.text }}>
          Activo
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={loading || !form.name.trim()}
          style={{ ...css.btnPrimary, opacity: !form.name.trim() ? 0.5 : 1 }}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={onCancel} style={css.btnSecondary}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PitchForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  loading,
  title,
}: {
  form: PitchFormData;
  onChange: (f: PitchFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  title: string;
}) {
  return (
    <div style={{ ...css.card, marginBottom: 16, background: colors.bg }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 14, color: colors.text }}>
        {title}
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Field label="Nombre">
          <input
            style={css.input}
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <select
            style={css.input}
            value={form.pitchType}
            onChange={(e) => onChange({ ...form, pitchType: e.target.value })}
          >
            {["F5", "F7", "F8", "F11"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Precio">
          <input
            type="number"
            style={css.input}
            value={form.price}
            placeholder="Sin precio"
            onChange={(e) => onChange({ ...form, price: e.target.value })}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={loading || !form.name.trim()}
          style={{
            ...css.btnPrimary,
            fontSize: 13,
            opacity: !form.name.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
        <button
          onClick={onCancel}
          style={{ ...css.btnSecondary, fontSize: 13 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          color: colors.muted,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
